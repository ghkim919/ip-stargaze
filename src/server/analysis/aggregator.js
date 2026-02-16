import { classifyIp, getSubnetKey } from './ipClassifier.js';
import config from '../config.js';
import { WINDOW_DURATIONS_MS, SUBNET_PARENT_MAP, AGGREGATOR_DEFAULTS, PORT_LABELS } from '../config/constants.js';

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
          ipStats: new Map(),
          protocols: { TCP: 0, UDP: 0, ICMP: 0 },
        };
        subnetMap.set(network, bucket);
      }

      bucket.count++;
      bucket.uniqueIps.add(event.sourceIp);
      bucket.bytes += event.bytes || 0;

      const ipStat = bucket.ipStats.get(event.sourceIp);
      if (ipStat) {
        ipStat.count++;
        ipStat.bytes += event.bytes || 0;
      } else {
        bucket.ipStats.set(event.sourceIp, { count: 1, bytes: event.bytes || 0 });
      }

      const proto = event.protocol;
      if (proto && bucket.protocols[proto] !== undefined) {
        bucket.protocols[proto]++;
      }
      if (subnetInfo.label && !bucket.label) {
        bucket.label = subnetInfo.label;
      }
    }

    const totalPackets = this.#events.length;
    const totalPps = parseFloat((totalPackets / windowSec).toFixed(1));

    const topIpsCount = AGGREGATOR_DEFAULTS.TOP_IPS_COUNT;

    let subnets = Array.from(subnetMap.values())
      .map((b) => {
        const topIps = Array.from(b.ipStats.entries())
          .map(([ip, stat]) => ({
            ip,
            count: stat.count,
            bytes: stat.bytes,
            pps: parseFloat((stat.count / windowSec).toFixed(1)),
          }))
          .sort((a, c) => c.count - a.count)
          .slice(0, topIpsCount);

        return {
          network: b.network,
          parentNetwork: b.parentNetwork,
          label: b.label,
          count: b.count,
          uniqueIps: b.uniqueIps.size,
          bytes: b.bytes,
          pps: parseFloat((b.count / windowSec).toFixed(1)),
          isPrivate: b.isPrivate,
          topIps,
          protocols: { ...b.protocols },
        };
      })
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
        topIps: [],
        protocols: {},
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

  buildSubnetDetail(network) {
    const now = Date.now();
    this.#pruneExpired(now);

    const windowMs = WINDOW_DURATIONS_MS[this.#window];
    const windowSec = windowMs / 1000;
    const level = this.#subnetLevel;

    const ipMap = new Map();
    const protoMap = new Map();
    let matched = false;

    for (const event of this.#events) {
      const subnetInfo = event.classification.subnets[level];
      if (!subnetInfo || subnetInfo.network !== network) continue;

      matched = true;

      const ip = event.sourceIp;
      const ipStat = ipMap.get(ip);
      if (ipStat) {
        ipStat.count++;
        ipStat.bytes += event.bytes || 0;
      } else {
        ipMap.set(ip, { count: 1, bytes: event.bytes || 0 });
      }

      const proto = event.protocol || 'OTHER';
      let protoBucket = protoMap.get(proto);
      if (!protoBucket) {
        protoBucket = { count: 0, bytes: 0, ports: new Map() };
        protoMap.set(proto, protoBucket);
      }
      protoBucket.count++;
      protoBucket.bytes += event.bytes || 0;

      if (proto !== 'ICMP' && event.destPort != null) {
        const port = event.destPort;
        protoBucket.ports.set(port, (protoBucket.ports.get(port) || 0) + 1);
      }
    }

    if (!matched) return null;

    const topPortsCount = AGGREGATOR_DEFAULTS.TOP_PORTS_COUNT;

    const allIps = Array.from(ipMap.entries())
      .map(([ip, stat]) => ({
        ip,
        count: stat.count,
        bytes: stat.bytes,
        pps: parseFloat((stat.count / windowSec).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count);

    const protocolDetail = {};
    for (const proto of ['TCP', 'UDP', 'ICMP']) {
      const bucket = protoMap.get(proto);
      if (!bucket) {
        protocolDetail[proto] = { count: 0, bytes: 0, pps: 0, topPorts: [] };
        continue;
      }

      let topPorts = [];
      if (proto !== 'ICMP') {
        topPorts = Array.from(bucket.ports.entries())
          .map(([port, count]) => ({
            port,
            count,
            label: PORT_LABELS[port] || null,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, topPortsCount);
      }

      protocolDetail[proto] = {
        count: bucket.count,
        bytes: bucket.bytes,
        pps: parseFloat((bucket.count / windowSec).toFixed(1)),
        topPorts,
      };
    }

    return { network, allIps, protocolDetail };
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
