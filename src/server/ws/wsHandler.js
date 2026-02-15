import config from '../config.js';

export default class WsHandler {
  #clients = new Set();
  #aggregator;
  #captureManager;

  constructor({ aggregator, captureManager }) {
    this.#aggregator = aggregator;
    this.#captureManager = captureManager;
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
    this.#clients.add(socket);
    console.log(`WebSocket client connected (total: ${this.#clients.size})`);

    this.#sendConfig(socket);

    const initialSnapshot = this.#aggregator.buildSnapshot();
    this.#send(socket, { type: 'snapshot', data: initialSnapshot });

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

  #handleMessage(socket, raw) {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      this.#send(socket, { type: 'error', data: { message: 'Invalid JSON' } });
      return;
    }

    switch (msg.type) {
      case 'setWindow':
        if (config.validWindows.includes(msg.value)) {
          this.#aggregator.setWindow(msg.value);
          this.#broadcastConfig();
        } else {
          this.#send(socket, { type: 'error', data: { message: 'Invalid window value' } });
        }
        break;

      case 'setSubnetLevel':
        if (config.validSubnetLevels.includes(msg.value)) {
          this.#aggregator.setSubnetLevel(msg.value);
          this.#broadcastConfig();
        } else {
          this.#send(socket, { type: 'error', data: { message: 'Invalid subnet level' } });
        }
        break;

      case 'setScenario':
        if (config.validScenarios.includes(msg.value)) {
          this.#captureManager.setScenario(msg.value);
          this.#broadcastConfig();
        } else {
          this.#send(socket, { type: 'error', data: { message: 'Invalid scenario' } });
        }
        break;

      default:
        this.#send(socket, { type: 'error', data: { message: `Unknown message type: ${msg.type}` } });
    }
  }

  #buildConfigPayload() {
    return {
      mode: this.#captureManager.mode,
      window: this.#aggregator.window,
      subnetLevel: this.#aggregator.subnetLevel,
      scenario: this.#captureManager.scenario,
      iface: config.interface,
    };
  }

  #sendConfig(socket) {
    this.#send(socket, { type: 'config', data: this.#buildConfigPayload() });
  }

  #broadcastConfig() {
    this.broadcast({ type: 'config', data: this.#buildConfigPayload() });
  }

  broadcast(message) {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    for (const client of this.#clients) {
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
    for (const client of this.#clients) {
      try {
        client.close();
      } catch {}
    }
    this.#clients.clear();
  }
}
