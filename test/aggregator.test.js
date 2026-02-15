import { describe, it, expect, beforeEach, vi } from 'vitest';
import Aggregator from '../src/server/analysis/aggregator.js';

describe('Aggregator', () => {
  let aggregator;

  beforeEach(() => {
    aggregator = new Aggregator({ window: '1m', subnetLevel: '/16' });
  });

  function createEvent(sourceIp, overrides = {}) {
    return {
      sourceIp,
      destPort: 443,
      protocol: 'TCP',
      timestamp: Date.now(),
      bytes: 1000,
      ...overrides,
    };
  }

  it('creates with default settings', () => {
    const agg = new Aggregator();
    expect(agg.window).toBe('5m');
    expect(agg.subnetLevel).toBe('/16');
  });

  it('falls back to defaults for invalid settings', () => {
    const agg = new Aggregator({ window: 'invalid', subnetLevel: '/99' });
    expect(agg.window).toBe('5m');
    expect(agg.subnetLevel).toBe('/16');
  });

  it('adds events and builds snapshot', () => {
    aggregator.addEvent(createEvent('192.168.1.100'));
    aggregator.addEvent(createEvent('192.168.1.200'));
    aggregator.addEvent(createEvent('10.0.0.5'));

    const snapshot = aggregator.buildSnapshot();

    expect(snapshot.window).toBe('1m');
    expect(snapshot.subnetLevel).toBe('/16');
    expect(snapshot.summary.totalPackets).toBe(3);
    expect(snapshot.summary.totalUniqueIps).toBe(3);
    expect(snapshot.subnets.length).toBe(2);

    const s192 = snapshot.subnets.find((s) => s.network === '192.168.0.0/16');
    expect(s192).toBeDefined();
    expect(s192.count).toBe(2);
    expect(s192.uniqueIps).toBe(2);

    const s10 = snapshot.subnets.find((s) => s.network === '10.0.0.0/16');
    expect(s10).toBeDefined();
    expect(s10.count).toBe(1);
    expect(s10.uniqueIps).toBe(1);
  });

  it('deduplicates unique IPs correctly', () => {
    aggregator.addEvent(createEvent('192.168.1.100'));
    aggregator.addEvent(createEvent('192.168.1.100'));
    aggregator.addEvent(createEvent('192.168.1.100'));

    const snapshot = aggregator.buildSnapshot();
    const subnet = snapshot.subnets.find((s) => s.network === '192.168.0.0/16');

    expect(subnet.count).toBe(3);
    expect(subnet.uniqueIps).toBe(1);
  });

  it('excludes expired events from window', () => {
    const now = Date.now();

    aggregator.addEvent(createEvent('192.168.1.1', { timestamp: now - 70_000 }));
    aggregator.addEvent(createEvent('10.0.0.1', { timestamp: now - 30_000 }));
    aggregator.addEvent(createEvent('10.0.0.2', { timestamp: now }));

    const snapshot = aggregator.buildSnapshot();

    expect(snapshot.summary.totalPackets).toBe(2);

    const expired = snapshot.subnets.find((s) => s.network === '192.168.0.0/16');
    expect(expired).toBeUndefined();
  });

  it('changes window setting', () => {
    aggregator.setWindow('5m');
    expect(aggregator.window).toBe('5m');

    aggregator.setWindow('invalid');
    expect(aggregator.window).toBe('5m');
  });

  it('changes subnet level', () => {
    aggregator.setSubnetLevel('/8');
    expect(aggregator.subnetLevel).toBe('/8');

    aggregator.setSubnetLevel('/99');
    expect(aggregator.subnetLevel).toBe('/8');
  });

  it('respects subnet level for grouping', () => {
    aggregator.setSubnetLevel('/8');

    aggregator.addEvent(createEvent('192.168.1.1'));
    aggregator.addEvent(createEvent('192.0.2.1'));

    const snapshot = aggregator.buildSnapshot();

    const s192 = snapshot.subnets.find((s) => s.network === '192.0.0.0/8');
    expect(s192).toBeDefined();
    expect(s192.count).toBe(2);
  });

  it('accumulates bytes correctly', () => {
    aggregator.addEvent(createEvent('10.0.0.1', { bytes: 500 }));
    aggregator.addEvent(createEvent('10.0.0.2', { bytes: 800 }));

    const snapshot = aggregator.buildSnapshot();
    const subnet = snapshot.subnets.find((s) => s.network === '10.0.0.0/16');

    expect(subnet.bytes).toBe(1300);
  });

  it('sorts subnets by count descending', () => {
    for (let i = 0; i < 10; i++) {
      aggregator.addEvent(createEvent('192.168.1.1'));
    }
    for (let i = 0; i < 5; i++) {
      aggregator.addEvent(createEvent('10.0.0.1'));
    }
    for (let i = 0; i < 20; i++) {
      aggregator.addEvent(createEvent('8.8.8.8'));
    }

    const snapshot = aggregator.buildSnapshot();

    expect(snapshot.subnets[0].network).toBe('8.8.0.0/16');
    expect(snapshot.subnets[1].network).toBe('192.168.0.0/16');
    expect(snapshot.subnets[2].network).toBe('10.0.0.0/16');
  });

  it('provides top subnets in summary', () => {
    for (let i = 0; i < 10; i++) {
      aggregator.addEvent(createEvent('192.168.1.1'));
    }
    aggregator.addEvent(createEvent('10.0.0.1'));

    const snapshot = aggregator.buildSnapshot();

    expect(snapshot.summary.topSubnets.length).toBeGreaterThan(0);
    expect(snapshot.summary.topSubnets[0]).toHaveProperty('network');
    expect(snapshot.summary.topSubnets[0]).toHaveProperty('count');
    expect(snapshot.summary.topSubnets[0]).toHaveProperty('percentage');
  });

  it('merges excess subnets into Others', () => {
    for (let i = 1; i <= 35; i++) {
      aggregator.addEvent(createEvent(`${i}.0.0.1`));
    }

    const snapshot = aggregator.buildSnapshot();

    const others = snapshot.subnets.find((s) => s.network === 'Others');
    expect(others).toBeDefined();
    expect(snapshot.subnets.length).toBeLessThanOrEqual(31);
  });

  it('ignores invalid IP events', () => {
    aggregator.addEvent(createEvent('invalid'));
    aggregator.addEvent(createEvent('999.999.999.999'));

    const snapshot = aggregator.buildSnapshot();
    expect(snapshot.summary.totalPackets).toBe(0);
  });

  it('runs periodic snapshot callback', async () => {
    const callback = vi.fn();

    aggregator.addEvent(createEvent('192.168.1.1'));
    aggregator.startPeriodicSnapshot(callback);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    aggregator.stopPeriodicSnapshot();

    expect(callback).toHaveBeenCalled();
    const snapshot = callback.mock.calls[0][0];
    expect(snapshot).toHaveProperty('timestamp');
    expect(snapshot).toHaveProperty('subnets');
  });

  it('cleans up on destroy', () => {
    aggregator.addEvent(createEvent('192.168.1.1'));
    aggregator.destroy();

    const snapshot = aggregator.buildSnapshot();
    expect(snapshot.summary.totalPackets).toBe(0);
  });
});
