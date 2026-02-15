import { describe, it, expect, afterEach } from 'vitest';
import Simulator from '../src/server/capture/simulator.js';

describe('Simulator', () => {
  let simulator;

  afterEach(() => {
    if (simulator) {
      simulator.stop();
      simulator = null;
    }
  });

  it('creates with default settings', () => {
    simulator = new Simulator();
    expect(simulator.scenario).toBe('normal');
    expect(simulator.eventsPerSecond).toBe(10);
  });

  it('falls back to normal for unknown scenario', () => {
    simulator = new Simulator({ scenario: 'unknown' });
    expect(simulator.scenario).toBe('normal');
  });

  it('enforces minimum eventsPerSecond of 1', () => {
    simulator = new Simulator({ eventsPerSecond: 0 });
    expect(simulator.eventsPerSecond).toBe(1);

    simulator.stop();
    simulator = new Simulator({ eventsPerSecond: -5 });
    expect(simulator.eventsPerSecond).toBe(1);
  });

  it('emits packet events with correct structure', async () => {
    simulator = new Simulator({ eventsPerSecond: 100 });

    const events = [];
    simulator.on('packet', (event) => {
      events.push(event);
    });

    simulator.start();

    await new Promise((resolve) => setTimeout(resolve, 200));
    simulator.stop();

    expect(events.length).toBeGreaterThan(0);

    const event = events[0];
    expect(event).toHaveProperty('sourceIp');
    expect(event).toHaveProperty('destPort');
    expect(event).toHaveProperty('protocol');
    expect(event).toHaveProperty('timestamp');
    expect(event).toHaveProperty('bytes');

    expect(typeof event.sourceIp).toBe('string');
    expect(event.sourceIp.split('.').length).toBe(4);
    expect(typeof event.destPort).toBe('number');
    expect(['TCP', 'UDP', 'ICMP']).toContain(event.protocol);
    expect(typeof event.timestamp).toBe('number');
    expect(event.bytes).toBeGreaterThanOrEqual(64);
    expect(event.bytes).toBeLessThanOrEqual(1500);
  });

  it('generates approximately the expected event rate', async () => {
    const eps = 50;
    simulator = new Simulator({ eventsPerSecond: eps });

    let count = 0;
    simulator.on('packet', () => count++);

    simulator.start();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    simulator.stop();

    expect(count).toBeGreaterThan(eps * 0.5);
    expect(count).toBeLessThan(eps * 2);
  });

  it('changes scenario at runtime', () => {
    simulator = new Simulator({ scenario: 'normal' });
    expect(simulator.scenario).toBe('normal');

    simulator.setScenario('attack');
    expect(simulator.scenario).toBe('attack');

    simulator.setScenario('scan');
    expect(simulator.scenario).toBe('scan');

    simulator.setScenario('invalid');
    expect(simulator.scenario).toBe('scan');
  });

  it('concentrates traffic in hotspot subnets for attack scenario', async () => {
    simulator = new Simulator({ scenario: 'attack', eventsPerSecond: 200 });

    const events = [];
    simulator.on('packet', (event) => events.push(event));

    simulator.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    simulator.stop();

    const hotspotCount = events.filter((e) => {
      return e.sourceIp.startsWith('185.220.') ||
             e.sourceIp.startsWith('185.221.') ||
             e.sourceIp.startsWith('91.134.');
    }).length;

    const ratio = hotspotCount / events.length;
    expect(ratio).toBeGreaterThan(0.5);
  });

  it('generates sequential IPs in scan scenario', async () => {
    simulator = new Simulator({ scenario: 'scan', eventsPerSecond: 100 });

    const events = [];
    simulator.on('packet', (event) => events.push(event));

    simulator.start();
    await new Promise((resolve) => setTimeout(resolve, 200));
    simulator.stop();

    expect(events.length).toBeGreaterThan(2);

    const ipToInt = (ip) => {
      const parts = ip.split('.').map(Number);
      return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    };

    for (let i = 1; i < Math.min(events.length, 10); i++) {
      const prev = ipToInt(events[i - 1].sourceIp);
      const curr = ipToInt(events[i].sourceIp);
      expect(curr).toBe(prev + 1);
    }
  });
});
