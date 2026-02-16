import config from '../config.js';
import { VALIDATION_RULES } from '../config/constants.js';
import { MESSAGE_TYPES, ERROR_MESSAGES } from '../../shared/protocol.js';
import { validateWindow, validateSubnetLevel, validateScenario, validateEPS, parseEPS } from './messageValidator.js';

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

  #handleMessage(socket, raw) {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: ERROR_MESSAGES.INVALID_JSON } });
      return;
    }

    switch (msg.type) {
      case MESSAGE_TYPES.SET_WINDOW:
        if (validateWindow(msg.value)) {
          this.#aggregator.setWindow(msg.value);
          this.#broadcastConfig();
        } else {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: ERROR_MESSAGES.INVALID_WINDOW } });
        }
        break;

      case MESSAGE_TYPES.SET_SUBNET_LEVEL:
        if (validateSubnetLevel(msg.value)) {
          this.#aggregator.setSubnetLevel(msg.value);
          this.#broadcastConfig();
        } else {
          this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: ERROR_MESSAGES.INVALID_SUBNET } });
        }
        break;

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
        const detail = this.#aggregator.buildSubnetDetail(msg.value);
        if (detail) {
          this.#send(socket, { type: MESSAGE_TYPES.SUBNET_DETAIL, data: detail });
        }
        break;
      }

      default:
        this.#send(socket, { type: MESSAGE_TYPES.ERROR, data: { message: ERROR_MESSAGES.UNKNOWN_TYPE(msg.type) } });
    }
  }

  #buildConfigPayload() {
    return {
      mode: this.#captureManager.mode,
      window: this.#aggregator.window,
      subnetLevel: this.#aggregator.subnetLevel,
      scenario: this.#captureManager.scenario,
      iface: config.interface,
      eventsPerSecond: this.#captureManager.eventsPerSecond,
    };
  }

  #sendConfig(socket) {
    this.#send(socket, { type: MESSAGE_TYPES.CONFIG, data: this.#buildConfigPayload() });
  }

  #broadcastConfig() {
    this.broadcast({ type: MESSAGE_TYPES.CONFIG, data: this.#buildConfigPayload() });
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
