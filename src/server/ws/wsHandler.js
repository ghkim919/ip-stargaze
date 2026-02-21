import config from '../config.js';
import { VALIDATION_RULES, LIMITS } from '../config/constants.js';
import { MESSAGE_TYPES, ERROR_MESSAGES } from '../../shared/protocol.js';
import { validateWindow, validateSubnetLevel, validateScenario, validateEPS, parseEPS, validateFilter, validateInterface, getAvailableInterfaces, validateSource, validateAgentAdd, validateAgentRemove, validateAgentEnabled, validateAgentTest } from './messageValidator.js';

export default class WsHandler {
  #clients = new Map();
  #aggregator;
  #captureManager;
  #remoteCollector = null;

  constructor({ aggregator, captureManager }) {
    this.#aggregator = aggregator;
    this.#captureManager = captureManager;
  }

  setRemoteCollector(collector) {
    this.#remoteCollector = collector;
  }

  get clientCount() {
    return this.#clients.size;
  }

  register(fastify) {
    fastify.get('/ws', { websocket: true }, (socket, req) => {
      this.#handleConnection(socket);
    });
  }

  #handleConnection(socket) {
    this.#clients.set(socket, { selectedSource: 'local' });
    console.log(`WebSocket client connected (total: ${this.#clients.size})`);

    this.#sendConfig(socket);

    const initialSnapshot = this.#aggregator.buildSnapshot();
    this.#send(socket, { type: MESSAGE_TYPES.SNAPSHOT, data: initialSnapshot });

    socket.on('message', (raw) => {
      this.#handleMessage(socket, raw);
    });

    socket.on('close', () => {
      this.#clients.delete(socket);
      console.log(`WebSocket client disconnected (total: ${this.#clients.size})`);
    });

    socket.on('error', (err) => {
      console.error('WebSocket error:', err.message);
      this.#clients.delete(socket);
    });
  }

  #getAggregatorForClient(socket) {
    const state = this.#clients.get(socket);
    if (!state) return this.#aggregator;

    const source = state.selectedSource;
    if (source === 'local') return this.#aggregator;

    if (this.#remoteCollector) {
      const agentAgg = this.#remoteCollector.getAggregator(source);
      if (agentAgg) return agentAgg;
    }

    return this.#aggregator;
  }

  async #handleMessage(socket, raw) {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: ERROR_MESSAGES.INVALID_JSON } });
      return;
    }

    switch (msg.type) {
      case MESSAGE_TYPES.SET_SOURCE: {
        if (!validateSource(msg.value)) {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: 'Invalid source value' } });
          break;
        }
        const state = this.#clients.get(socket);
        if (state) {
          state.selectedSource = msg.value;
        }
        this.#sendConfig(socket);
        const agg = this.#getAggregatorForClient(socket);
        const snapshot = agg.buildSnapshot();
        this.#send(socket, { type: MESSAGE_TYPES.SNAPSHOT, data: snapshot });
        break;
      }

      case MESSAGE_TYPES.SET_WINDOW: {
        if (validateWindow(msg.value)) {
          const agg = this.#getAggregatorForClient(socket);
          agg.setWindow(msg.value);
          this.#broadcastConfig();
        } else {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: ERROR_MESSAGES.INVALID_WINDOW } });
        }
        break;
      }

      case MESSAGE_TYPES.SET_SUBNET_LEVEL: {
        if (validateSubnetLevel(msg.value)) {
          const agg = this.#getAggregatorForClient(socket);
          agg.setSubnetLevel(msg.value);
          this.#broadcastConfig();
        } else {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: ERROR_MESSAGES.INVALID_SUBNET } });
        }
        break;
      }

      case MESSAGE_TYPES.SET_MAX_NODES: {
        const n = parseInt(msg.value, 10);
        if (n >= LIMITS.MAX_NODES_MIN && n <= LIMITS.MAX_NODES_MAX) {
          const agg = this.#getAggregatorForClient(socket);
          agg.setMaxNodes(n);
          this.#broadcastConfig();
        } else {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: `Max nodes must be between ${LIMITS.MAX_NODES_MIN} and ${LIMITS.MAX_NODES_MAX}` } });
        }
        break;
      }

      case MESSAGE_TYPES.SET_SCENARIO:
        if (validateScenario(msg.value)) {
          this.#captureManager.setScenario(msg.value);
          this.#broadcastConfig();
        } else {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: ERROR_MESSAGES.INVALID_SCENARIO } });
        }
        break;

      case MESSAGE_TYPES.SET_EVENTS_PER_SECOND:
        if (validateEPS(msg.value)) {
          this.#captureManager.setEventsPerSecond(parseEPS(msg.value));
          this.#broadcastConfig();
        } else {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: ERROR_MESSAGES.INVALID_EPS(VALIDATION_RULES.EPS_MIN, VALIDATION_RULES.EPS_MAX) } });
        }
        break;

      case MESSAGE_TYPES.GET_SUBNET_DETAIL: {
        const agg = this.#getAggregatorForClient(socket);
        const detail = agg.buildSubnetDetail(msg.value);
        if (detail) {
          this.#send(socket, { type: MESSAGE_TYPES.SUBNET_DETAIL, data: detail });
        }
        break;
      }

      case MESSAGE_TYPES.SET_FILTER: {
        if (validateFilter(msg.value)) {
          const agg = this.#getAggregatorForClient(socket);
          agg.setFilter({
            ports: msg.value.ports || [],
            protocols: msg.value.protocols || [],
          });
          this.#broadcastConfig();
        } else {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: 'Invalid filter' } });
        }
        break;
      }

      case MESSAGE_TYPES.GET_INTERFACES: {
        const interfaces = getAvailableInterfaces();
        this.#send(socket, { type: MESSAGE_TYPES.INTERFACES, data: interfaces });
        break;
      }

      case MESSAGE_TYPES.SET_INTERFACE: {
        if (this.#captureManager.mode !== 'live') {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: 'Interface change is only available in live mode' } });
          break;
        }
        if (validateInterface(msg.value)) {
          try {
            this.#captureManager.setInterface(msg.value);
            this.#broadcastConfig();
          } catch (err) {
            this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: err.message } });
          }
        } else {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: 'Invalid interface' } });
        }
        break;
      }

      case MESSAGE_TYPES.ADD_AGENT: {
        if (!this.#remoteCollector) {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: 'Remote collector not available' } });
          break;
        }
        if (!validateAgentAdd(msg.value)) {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: 'Invalid agent data' } });
          break;
        }
        const addResult = await this.#remoteCollector.addAgent({
          url: msg.value.url,
          apiKey: msg.value.apiKey || '',
          label: msg.value.label || '',
        });
        if (addResult.success) {
          this.broadcast({ type: MESSAGE_TYPES.AGENTS, data: this.#remoteCollector.getAgents() });
        } else {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: addResult.error } });
        }
        break;
      }

      case MESSAGE_TYPES.REMOVE_AGENT: {
        if (!this.#remoteCollector) {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: 'Remote collector not available' } });
          break;
        }
        if (!validateAgentRemove(msg.value)) {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: 'Invalid agent id' } });
          break;
        }
        const removedId = msg.value.id;
        this.#remoteCollector.removeAgent(removedId);
        for (const [client, state] of this.#clients) {
          if (state.selectedSource === removedId) {
            state.selectedSource = 'local';
            this.#sendConfig(client);
          }
        }
        this.broadcast({ type: MESSAGE_TYPES.AGENTS, data: this.#remoteCollector.getAgents() });
        break;
      }

      case MESSAGE_TYPES.SET_AGENT_ENABLED: {
        if (!this.#remoteCollector) {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: 'Remote collector not available' } });
          break;
        }
        if (!validateAgentEnabled(msg.value)) {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: 'Invalid agent enabled data' } });
          break;
        }
        this.#remoteCollector.setAgentEnabled(msg.value.id, msg.value.enabled);
        this.broadcast({ type: MESSAGE_TYPES.AGENTS, data: this.#remoteCollector.getAgents() });
        break;
      }

      case MESSAGE_TYPES.TEST_AGENT: {
        if (!this.#remoteCollector) {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: 'Remote collector not available' } });
          break;
        }
        if (!validateAgentTest(msg.value)) {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: 'Invalid test agent data' } });
          break;
        }
        const testResult = await this.#remoteCollector.testAgent(msg.value.url, msg.value.apiKey || '');
        this.#send(socket, { type: MESSAGE_TYPES.TEST_AGENT_RESULT, data: testResult });
        break;
      }

      case MESSAGE_TYPES.GET_AGENTS: {
        if (!this.#remoteCollector) {
          this.#send(socket, { type: MESSAGE_TYPES.AGENTS, data: [] });
          break;
        }
        this.#send(socket, { type: MESSAGE_TYPES.AGENTS, data: this.#remoteCollector.getAgents() });
        break;
      }

      default:
        this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: ERROR_MESSAGES.UNKNOWN_TYPE(msg.type) } });
    }
  }

  #buildConfigPayload(aggregator) {
    const agg = aggregator || this.#aggregator;
    const isRemote = agg !== this.#aggregator;
    return {
      mode: isRemote ? 'remote' : this.#captureManager.mode,
      window: agg.window,
      subnetLevel: agg.subnetLevel,
      maxNodes: agg.maxNodes,
      scenario: this.#captureManager.scenario,
      iface: config.interface,
      eventsPerSecond: this.#captureManager.eventsPerSecond,
      filter: agg.filter,
    };
  }

  #sendConfig(socket) {
    const agg = this.#getAggregatorForClient(socket);
    this.#send(socket, { type: MESSAGE_TYPES.CONFIG, data: this.#buildConfigPayload(agg) });
  }

  #broadcastConfig() {
    for (const [client] of this.#clients) {
      try {
        const agg = this.#getAggregatorForClient(client);
        client.send(JSON.stringify({ type: MESSAGE_TYPES.CONFIG, data: this.#buildConfigPayload(agg) }));
      } catch {
        this.#clients.delete(client);
      }
    }
  }

  broadcastSnapshots() {
    for (const [client, state] of this.#clients) {
      try {
        const agg = this.#getAggregatorForClient(client);
        const snapshot = agg.buildSnapshot();
        client.send(JSON.stringify({ type: MESSAGE_TYPES.SNAPSHOT, data: snapshot }));
      } catch {
        this.#clients.delete(client);
      }
    }
  }

  broadcast(message) {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    for (const client of this.#clients.keys()) {
      try {
        client.send(payload);
      } catch {
        this.#clients.delete(client);
      }
    }
  }

  #send(socket, message) {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      this.#clients.delete(socket);
    }
  }

  destroy() {
    for (const client of this.#clients.keys()) {
      try {
        client.close();
      } catch {}
    }
    this.#clients.clear();
  }
}
