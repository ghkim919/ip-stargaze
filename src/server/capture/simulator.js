import { EventEmitter } from 'node:events';

const PROTOCOLS = ['TCP', 'UDP', 'ICMP'];
const COMMON_PORTS = [80, 443, 22, 53, 8080, 3306, 5432, 6379, 27017, 25, 110, 143, 993, 995, 21, 3389];

const HOTSPOT_SUBNETS_BY_SCENARIO = {
  normal: [
    { base: [192, 168], weight: 0.2 },
    { base: [10, 0], weight: 0.15 },
    { base: [172, 217], weight: 0.1 },
    { base: [8, 8], weight: 0.08 },
    { base: [1, 1], weight: 0.05 },
    { base: [104, 16], weight: 0.05 },
    { base: [13, 107], weight: 0.05 },
    { base: [52, 0], weight: 0.05 },
  ],
  attack: [
    { base: [185, 220], weight: 0.35 },
    { base: [185, 221], weight: 0.25 },
    { base: [91, 134], weight: 0.15 },
  ],
  scan: [],
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted(hotspots) {
  const roll = Math.random();
  let cumulative = 0;

  for (const spot of hotspots) {
    cumulative += spot.weight;
    if (roll < cumulative) {
      return spot.base;
    }
  }
  return null;
}

function generateIp(scenario, scanState) {
  if (scenario === 'scan') {
    scanState.current = (scanState.current + 1) & 0xffffffff;
    const ip = scanState.current;
    return `${(ip >>> 24) & 0xff}.${(ip >>> 16) & 0xff}.${(ip >>> 8) & 0xff}.${ip & 0xff}`;
  }

  const hotspots = HOTSPOT_SUBNETS_BY_SCENARIO[scenario] || HOTSPOT_SUBNETS_BY_SCENARIO.normal;
  const base = pickWeighted(hotspots);

  if (base) {
    const octets = [...base];
    while (octets.length < 4) {
      octets.push(randomInt(1, 254));
    }
    return octets.join('.');
  }

  return `${randomInt(1, 223)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
}

function generateEvent(scenario, scanState) {
  return {
    sourceIp: generateIp(scenario, scanState),
    destPort: COMMON_PORTS[randomInt(0, COMMON_PORTS.length - 1)],
    protocol: PROTOCOLS[randomInt(0, PROTOCOLS.length - 1)],
    timestamp: Date.now(),
    bytes: randomInt(64, 1500),
  };
}

export default class Simulator extends EventEmitter {
  #scenario;
  #eventsPerSecond;
  #timer = null;
  #scanState = { current: randomInt(0, 0xffffff) };

  constructor({ scenario = 'normal', eventsPerSecond = 10 } = {}) {
    super();
    this.#scenario = HOTSPOT_SUBNETS_BY_SCENARIO[scenario] !== undefined ? scenario : 'normal';
    this.#eventsPerSecond = Math.max(1, eventsPerSecond);

    if (scenario !== this.#scenario) {
      console.warn(`Unknown scenario "${scenario}", falling back to "normal"`);
    }
  }

  get scenario() {
    return this.#scenario;
  }

  get eventsPerSecond() {
    return this.#eventsPerSecond;
  }

  setScenario(scenario) {
    if (HOTSPOT_SUBNETS_BY_SCENARIO[scenario] === undefined) {
      console.warn(`Unknown scenario "${scenario}", ignoring`);
      return;
    }
    this.#scenario = scenario;
    if (scenario === 'scan') {
      this.#scanState.current = randomInt(0, 0xffffff);
    }
  }

  setEventsPerSecond(eps) {
    this.#eventsPerSecond = Math.max(1, Math.min(1000, eps));
  }

  start() {
    if (this.#timer) return;

    const intervalMs = Math.max(1, Math.floor(1000 / this.#eventsPerSecond));
    const eventsPerTick = Math.max(1, Math.round(this.#eventsPerSecond / (1000 / intervalMs)));

    this.#scheduleNext(intervalMs, eventsPerTick);
    console.log(`Simulation mode active, generating ~${this.#eventsPerSecond} events/sec (scenario: ${this.#scenario})`);
  }

  #scheduleNext(intervalMs, eventsPerTick) {
    this.#timer = setTimeout(() => {
      const currentIntervalMs = Math.max(1, Math.floor(1000 / this.#eventsPerSecond));
      const currentEventsPerTick = Math.max(1, Math.round(this.#eventsPerSecond / (1000 / currentIntervalMs)));

      for (let i = 0; i < currentEventsPerTick; i++) {
        const event = generateEvent(this.#scenario, this.#scanState);
        this.emit('packet', event);
      }

      this.#scheduleNext(currentIntervalMs, currentEventsPerTick);
    }, intervalMs);
  }

  stop() {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.removeAllListeners();
  }
}
