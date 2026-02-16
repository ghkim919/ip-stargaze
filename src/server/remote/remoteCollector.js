import AgentConnection from './agentConnection.js';
import AgentStore from './agentStore.js';
import Aggregator from '../analysis/aggregator.js';
import config from '../config.js';

export default class RemoteCollector {
  #store;
  #connections = new Map();
  #aggregators = new Map();
  #pollingTimer = null;
  #pollingIntervalMs;
  #pollingTimeoutMs;
  #maxEventsPerPoll;
  #maxAgents;
  #polling = false;

  constructor({ agentStore, pollingIntervalMs = 2000, pollingTimeoutMs = 5000, maxEventsPerPoll = 10_000, maxAgents = 20 }) {
    this.#store = agentStore;
    this.#pollingIntervalMs = pollingIntervalMs;
    this.#pollingTimeoutMs = pollingTimeoutMs;
    this.#maxEventsPerPoll = maxEventsPerPoll;
    this.#maxAgents = maxAgents;

    for (const agent of this.#store.getEnabled()) {
      this.#createConnection(agent);
      this.#createAggregator(agent.id);
    }
  }

  start() {
    if (this.#pollingTimer) return;
    this.#pollingTimer = setInterval(() => this.#pollAll(), this.#pollingIntervalMs);
  }

  stop() {
    if (this.#pollingTimer) {
      clearInterval(this.#pollingTimer);
      this.#pollingTimer = null;
    }
  }

  getAggregator(agentId) {
    return this.#aggregators.get(agentId) || null;
  }

  async addAgent({ url, apiKey, label = '' }) {
    if (this.#store.size >= this.#maxAgents) {
      return { success: false, error: `Maximum agent limit (${this.#maxAgents}) reached` };
    }

    const testResult = await this.testAgent(url, apiKey);
    if (!testResult.success) {
      return { success: false, error: testResult.error };
    }

    const id = testResult.agentId;
    if (this.#store.get(id)) {
      return { success: false, error: `Agent with id "${id}" already exists` };
    }

    const agent = this.#store.add({ id, url, apiKey, label, enabled: true });
    this.#createConnection(agent);
    this.#createAggregator(id);

    return { success: true, agent };
  }

  removeAgent(id) {
    this.#connections.delete(id);
    this.#destroyAggregator(id);
    return this.#store.remove(id);
  }

  setAgentEnabled(id, enabled) {
    const result = this.#store.setEnabled(id, enabled);
    if (!result) return false;

    if (enabled) {
      const agent = this.#store.get(id);
      if (agent && !this.#connections.has(id)) {
        this.#createConnection(agent);
      }
      if (!this.#aggregators.has(id)) {
        this.#createAggregator(id);
      }
    } else {
      this.#connections.delete(id);
    }

    return true;
  }

  async testAgent(url, apiKey) {
    const tempConn = new AgentConnection(
      { id: 'test', url, apiKey },
      { timeoutMs: this.#pollingTimeoutMs },
    );
    return tempConn.testConnection();
  }

  getAgents() {
    const agents = this.#store.getAll();
    return agents.map((agent) => {
      const conn = this.#connections.get(agent.id);
      return {
        ...agent,
        status: conn ? conn.health : 'offline',
        apiKey: undefined,
      };
    });
  }

  async #pollAll() {
    if (this.#polling) return;
    this.#polling = true;

    try {
      const enabledAgents = this.#store.getEnabled();
      const pollPromises = enabledAgents.map((agent) => this.#pollAgent(agent.id));
      await Promise.allSettled(pollPromises);
    } finally {
      this.#polling = false;
    }
  }

  async #pollAgent(agentId) {
    const conn = this.#connections.get(agentId);
    if (!conn) return;

    if (conn.backoffMs > 0) {
      const elapsed = Date.now() % conn.backoffMs;
      if (elapsed > this.#pollingIntervalMs) return;
    }

    const result = await conn.poll();

    if (result.error) return;

    const aggregator = this.#aggregators.get(agentId);
    if (!aggregator) return;

    for (const event of result.events) {
      aggregator.addEvent({
        sourceIp: event.sourceIp,
        destPort: event.destPort,
        protocol: event.protocol,
        timestamp: event.timestamp,
        bytes: event.bytes,
      });
    }
  }

  #createConnection(agent) {
    const conn = new AgentConnection(agent, {
      timeoutMs: this.#pollingTimeoutMs,
      maxEventsPerPoll: this.#maxEventsPerPoll,
    });
    this.#connections.set(agent.id, conn);
    return conn;
  }

  #createAggregator(agentId) {
    if (this.#aggregators.has(agentId)) return;
    const aggregator = new Aggregator({
      window: config.defaultWindow,
      subnetLevel: config.defaultSubnetLevel,
    });
    this.#aggregators.set(agentId, aggregator);
  }

  #destroyAggregator(agentId) {
    const aggregator = this.#aggregators.get(agentId);
    if (aggregator) {
      aggregator.destroy();
      this.#aggregators.delete(agentId);
    }
  }

  destroy() {
    this.stop();
    this.#connections.clear();
    for (const aggregator of this.#aggregators.values()) {
      aggregator.destroy();
    }
    this.#aggregators.clear();
  }
}
