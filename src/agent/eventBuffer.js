import { AGENT_DEFAULTS } from '../server/config/constants.js';

export default class EventBuffer {
  #buffer;
  #capacity;
  #head = 0;
  #size = 0;
  #nextSeq = 1;

  constructor(capacity = AGENT_DEFAULTS.BUFFER_CAPACITY) {
    this.#capacity = Math.max(1, capacity);
    this.#buffer = new Array(this.#capacity);
  }

  get capacity() {
    return this.#capacity;
  }

  get size() {
    return this.#size;
  }

  get oldestSeq() {
    if (this.#size === 0) return 0;
    return this.#nextSeq - this.#size;
  }

  get newestSeq() {
    if (this.#size === 0) return 0;
    return this.#nextSeq - 1;
  }

  push(event) {
    const seq = this.#nextSeq++;
    const index = (this.#head) % this.#capacity;
    this.#buffer[index] = { ...event, seq };
    this.#head = (this.#head + 1) % this.#capacity;

    if (this.#size < this.#capacity) {
      this.#size++;
    }

    return seq;
  }

  getSince(since, limit = AGENT_DEFAULTS.DEFAULT_EVENT_LIMIT) {
    if (this.#size === 0) {
      return { events: [], gapDetected: false };
    }

    const oldest = this.oldestSeq;
    const newest = this.newestSeq;
    const gapDetected = since > 0 && since < oldest - 1;

    let startSeq = since + 1;
    if (startSeq < oldest) {
      startSeq = oldest;
    }

    if (startSeq > newest) {
      return { events: [], gapDetected };
    }

    const available = newest - startSeq + 1;
    const count = Math.min(available, Math.max(0, limit));
    const events = new Array(count);

    const startOffset = startSeq - oldest;
    const tailIndex = (this.#head - this.#size + this.#capacity) % this.#capacity;

    for (let i = 0; i < count; i++) {
      const bufIdx = (tailIndex + startOffset + i) % this.#capacity;
      events[i] = this.#buffer[bufIdx];
    }

    return { events, gapDetected };
  }

  getAll(limit = AGENT_DEFAULTS.DEFAULT_EVENT_LIMIT) {
    return this.getSince(0, limit);
  }

  stats() {
    return {
      size: this.#size,
      capacity: this.#capacity,
      oldestSeq: this.oldestSeq,
      newestSeq: this.newestSeq,
    };
  }
}
