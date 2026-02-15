import { classifyIp, getSubnetKey } from './ipClassifier.js';
import config from '../config.js';
import { WINDOW_DURATIONS_MS, SUBNET_PARENT_MAP, AGGREGATOR_DEFAULTS } from '../config/constants.js';

export default class Aggregator {
  #events = [];
  #window;
  #subnetLevel;
  #snapshotTimer = null;
  #onSnapshot = null;

  constructor({ window = config.defaultWindow, subnetLevel = config.defaultSubnetLevel } = {}) {
    this.#window = WINDOW_DURATIONS_MS[window] ? window : config.defaultWindow;
    this.#subnetLevel = config.validSubnetLevels.includes(subnetLevel) ? subnetLevel : config.defaultSubnetLevel;
  }

  get window() {
    return this.#window;
  }

  get subnetLevel() {
    return this.#subnetLevel;
  }

  setWindow(window) {
    if (WINDOW_DURATIONS_MS[window]) {
      this.#window = window;
    }
  }

  setSubnetLevel(level) {
    if (config.validSubnetLevels.includes(level)) {
      this.#subnetLevel = level;
    }
  }

  addEvent(packetEvent) {
    const classification = classifyIp(packetEvent.sourceIp);
    if (!classification) return;

    this.#events.push({
      ...packetEvent,
      classification,
      _ts: packetEvent.timestamp,
    });
  }

  #pruneExpired(now) {
    const windowMs = WINDOW_DURATIONS_MS[this.#window];
    const cutoff = now - windowMs;

    let pruneIndex = 0;
    while (pruneIndex < this.#events.length && this.#events[pruneIndex]._ts < cutoff) {
      pruneIndex++;
    }

    if (pruneIndex > 0) {
      this.#events.splice(0, pruneIndex);
    }
  }

  buildSnapshot() {
    const now = Date.now();
    this.#pruneExpired(now);

    const windowMs = WINDOW_DURATIONS_MS[this.#window];
    const windowSec = windowMs / 1000;
    const level = this.#subnetLevel;

    const parentLevel = SUBNET_PARENT_MAP[level] || null;

    const subnetMap = new Map();
    const globalUniqueIps = new Set();

    for (const event of this.#events) {
      const subnetInfo = event.classification.subnets[level];
      if (!subnetInfo) continue;

      const network = subnetInfo.network;
      globalUniqueIps.add(event.sourceIp);

      let bucket = subnetMap.get(network);
      if (!bucket) {
        const parentInfo = parentLevel ? event.classification.subnets[parentLevel] : null;
        bucket = {
          network,
          label: subnetInfo.label,
          parentNetwork: parentInfo ? parentInfo.network : null,
          count: 0,
          uniqueIps: new Set(),
          bytes: 0,
          isPrivate: event.classification.isPrivate,
        };
        subnetMap.set(network, bucket);
      }

      bucket.count++;
      bucket.uniqueIps.add(event.sourceIp);
      bucket.bytes += event.bytes || 0;
      if (subnetInfo.label && !bucket.label) {
        bucket.label = subnetInfo.label;
      }
    }

    const totalPackets = this.#events.length;
    const totalPps = parseFloat((totalPackets / windowSec).toFixed(1));

    let subnets = Array.from(subnetMap.values())
      .map((b) => ({
        network: b.network,
        parentNetwork: b.parentNetwork,
        label: b.label,
        count: b.count,
        uniqueIps: b.uniqueIps.size,
        bytes: b.bytes,
        pps: parseFloat((b.count / windowSec).toFixed(1)),
        isPrivate: b.isPrivate,
      }))
      .sort((a, b) => b.count - a.count);

    let othersCount = 0;
    let othersBytes = 0;
    let othersUniqueIps = new Set();

    if (subnets.length > config.maxSubnetsInSnapshot) {
      const overflow = subnets.splice(config.maxSubnetsInSnapshot);
      for (const s of overflow) {
        othersCount += s.count;
        othersBytes += s.bytes;
      }

      for (const event of this.#events) {
        const subnetInfo = event.classification.subnets[level];
        if (!subnetInfo) continue;
        const found = subnets.find((s) => s.network === subnetInfo.network);
        if (!found) {
          othersUniqueIps.add(event.sourceIp);
        }
      }

      subnets.push({
        network: 'Others',
        parentNetwork: null,
        label: null,
        count: othersCount,
        uniqueIps: othersUniqueIps.size,
        bytes: othersBytes,
        pps: parseFloat((othersCount / windowSec).toFixed(1)),
        isPrivate: false,
      });
    }

    const topSubnets = subnets.slice(0, AGGREGATOR_DEFAULTS.TOP_SUBNETS_COUNT).map((s) => ({
      network: s.network,
      count: s.count,
      percentage: totalPackets > 0 ? parseFloat(((s.count / totalPackets) * 100).toFixed(1)) : 0,
    }));

    return {
      timestamp: now,
      window: this.#window,
      subnetLevel: this.#subnetLevel,
      summary: {
        totalPackets,
        totalUniqueIps: globalUniqueIps.size,
        totalPps,
        topSubnets,
      },
      subnets,
    };
  }

  startPeriodicSnapshot(callback) {
    this.#onSnapshot = callback;
    this.#snapshotTimer = setInterval(() => {
      const snapshot = this.buildSnapshot();
      if (this.#onSnapshot) {
        this.#onSnapshot(snapshot);
      }
    }, config.snapshotIntervalMs);
  }

  stopPeriodicSnapshot() {
    if (this.#snapshotTimer) {
      clearInterval(this.#snapshotTimer);
      this.#snapshotTimer = null;
    }
    this.#onSnapshot = null;
  }

  destroy() {
    this.stopPeriodicSnapshot();
    this.#events = [];
  }
}
