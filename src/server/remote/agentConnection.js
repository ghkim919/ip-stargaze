import ClockSync from './clockSync.js';
import { REMOTE_DEFAULTS } from '../config/constants.js';

const HEALTH_WINDOW = 3;
const MIN_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30_000;

export default class AgentConnection {
  #agentId;
  #url;
  #apiKey;
  #label;
  #lastSeq = 0;
  #clockSync = new ClockSync();
  #recentResults = [];
  #consecutiveFailures = 0;
  #lastPollTime = 0;
  #timeoutMs;
  #maxEventsPerPoll;

  constructor({ id, url, apiKey, label = '' }, { timeoutMs = REMOTE_DEFAULTS.POLLING_TIMEOUT_MS, maxEventsPerPoll = REMOTE_DEFAULTS.MAX_EVENTS_PER_POLL } = {}) {
    this.#agentId = id;
    this.#url = url.replace(/\/+$/, '');
    this.#apiKey = apiKey;
    this.#label = label;
    this.#timeoutMs = timeoutMs;
    this.#maxEventsPerPoll = maxEventsPerPoll;
  }

  get agentId() {
    return this.#agentId;
  }

  get label() {
    return this.#label;
  }

  get lastSeq() {
    return this.#lastSeq;
  }

  get health() {
    if (this.#recentResults.length === 0) return 'offline';

    const window = this.#recentResults.slice(-HEALTH_WINDOW);
    const failures = window.filter((r) => !r).length;

    if (failures === 0) return 'online';
    if (failures >= HEALTH_WINDOW) return 'offline';
    return 'degraded';
  }

  get backoffMs() {
    if (this.#consecutiveFailures === 0) return 0;
    const backoff = MIN_BACKOFF_MS * Math.pow(2, this.#consecutiveFailures - 1);
    return Math.min(backoff, MAX_BACKOFF_MS);
  }

  get clockOffset() {
    return this.#clockSync.offset;
  }

  get lastPollTime() {
    return this.#lastPollTime;
  }

  async poll() {
    this.#lastPollTime = Date.now();
    const localSendTime = Date.now();
    const url = `${this.#url}/api/events?since=${this.#lastSeq}&limit=${this.#maxEventsPerPoll}`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.#apiKey}` },
        signal: AbortSignal.timeout(this.#timeoutMs),
      });

      if (!response.ok) {
        this.#recordFailure();
        return { events: [], error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      const localRecvTime = Date.now();

      this.#clockSync.update({
        localSendTime,
        localRecvTime,
        serverTimestamp: data.serverTimestamp,
      });

      if (data.gapDetected) {
        console.warn(`[AgentConnection] Gap detected for agent ${this.#agentId} - some events may have been lost`);
      }

      if (data.events && data.events.length > 0) {
        this.#lastSeq = data.sequenceEnd;
      }

      this.#recordSuccess();

      const adjustedEvents = (data.events || []).map((event) => ({
        ...event,
        timestamp: this.#clockSync.adjustTimestamp(event.timestamp),
      }));

      return {
        events: adjustedEvents,
        gapDetected: data.gapDetected || false,
        hasMore: data.hasMore || false,
      };
    } catch (err) {
      this.#recordFailure();
      return { events: [], error: err.message };
    }
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.#url}/api/health`, {
        signal: AbortSignal.timeout(this.#timeoutMs),
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { success: true, agentId: data.agentId, info: data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  #recordResult(success) {
    this.#recentResults.push(success);
    if (this.#recentResults.length > HEALTH_WINDOW) {
      this.#recentResults.shift();
    }
  }

  #recordSuccess() {
    this.#recordResult(true);
    this.#consecutiveFailures = 0;
  }

  #recordFailure() {
    this.#recordResult(false);
    this.#consecutiveFailures++;
  }

  resetSeq() {
    this.#lastSeq = 0;
  }
}
