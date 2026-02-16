import { readFileSync, writeFileSync } from 'node:fs';

export default class AgentStore {
  #agents = new Map();
  #filePath;

  constructor(filePath) {
    this.#filePath = filePath;
    this.#load();
  }

  #load() {
    try {
      const raw = readFileSync(this.#filePath, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.agents)) {
        for (const agent of data.agents) {
          if (agent.id && agent.url && agent.apiKey) {
            this.#agents.set(agent.id, {
              id: agent.id,
              url: agent.url,
              apiKey: agent.apiKey,
              label: agent.label || '',
              enabled: agent.enabled !== false,
            });
          }
        }
      }
    } catch {
      // File doesn't exist or invalid - start with empty list
    }
  }

  #save() {
    const data = {
      agents: Array.from(this.#agents.values()),
    };
    try {
      writeFileSync(this.#filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[AgentStore] Failed to save agents file: ${err.message}`);
    }
  }

  add({ id, url, apiKey, label = '', enabled = true }) {
    const agent = { id, url, apiKey, label, enabled };
    this.#agents.set(id, agent);
    this.#save();
    return agent;
  }

  remove(id) {
    const existed = this.#agents.delete(id);
    if (existed) this.#save();
    return existed;
  }

  get(id) {
    const agent = this.#agents.get(id);
    return agent ? { ...agent } : null;
  }

  setEnabled(id, enabled) {
    const agent = this.#agents.get(id);
    if (!agent) return false;
    agent.enabled = enabled;
    this.#save();
    return true;
  }

  getAll() {
    return Array.from(this.#agents.values()).map((a) => ({ ...a }));
  }

  getEnabled() {
    return this.getAll().filter((a) => a.enabled);
  }

  get size() {
    return this.#agents.size;
  }
}
