import { describe, it, expect, beforeEach } from 'vitest';
import ClockSync from '../src/server/remote/clockSync.js';

describe('ClockSync', () => {
  let clockSync;

  beforeEach(() => {
    clockSync = new ClockSync();
  });

  it('has zero offset initially', () => {
    expect(clockSync.offset).toBe(0);
  });

  it('calculates offset from RTT and server timestamp', () => {
    const localSendTime = 1000;
    const localRecvTime = 1100;
    const serverTimestamp = 1040;

    clockSync.update({ localSendTime, localRecvTime, serverTimestamp });

    const rtt = 100;
    const estimatedServerNow = 1040 + rtt / 2;
    const expectedOffset = 1100 - estimatedServerNow;
    expect(clockSync.offset).toBe(expectedOffset);
  });

  it('applies EMA smoothing on subsequent updates', () => {
    clockSync.update({ localSendTime: 1000, localRecvTime: 1100, serverTimestamp: 1050 });
    const firstOffset = clockSync.offset;

    clockSync.update({ localSendTime: 2000, localRecvTime: 2100, serverTimestamp: 2050 });
    const secondOffset = clockSync.offset;

    expect(secondOffset).toBe(firstOffset);
  });

  it('applies EMA with alpha=0.2 for different offsets', () => {
    clockSync.update({ localSendTime: 1000, localRecvTime: 1100, serverTimestamp: 1050 });
    const first = clockSync.offset;

    clockSync.update({ localSendTime: 2000, localRecvTime: 2200, serverTimestamp: 2050 });

    const rtt2 = 200;
    const estimatedServerNow2 = 2050 + rtt2 / 2;
    const newOffset = 2200 - estimatedServerNow2;
    const expected = 0.2 * newOffset + 0.8 * first;
    expect(clockSync.offset).toBeCloseTo(expected, 5);
  });

  it('adjusts timestamp using current offset', () => {
    clockSync.update({ localSendTime: 1000, localRecvTime: 1100, serverTimestamp: 1000 });
    const offset = clockSync.offset;

    const remoteTs = 5000;
    const adjusted = clockSync.adjustTimestamp(remoteTs);
    expect(adjusted).toBe(remoteTs + offset);
  });

  it('returns original timestamp when no offset has been set', () => {
    expect(clockSync.adjustTimestamp(5000)).toBe(5000);
  });

  it('resets offset to null', () => {
    clockSync.update({ localSendTime: 1000, localRecvTime: 1100, serverTimestamp: 1000 });
    expect(clockSync.offset).not.toBe(0);

    clockSync.reset();
    expect(clockSync.offset).toBe(0);
  });

  it('uses raw offset for first update after reset', () => {
    clockSync.update({ localSendTime: 1000, localRecvTime: 1100, serverTimestamp: 1050 });
    clockSync.update({ localSendTime: 2000, localRecvTime: 2100, serverTimestamp: 2050 });

    clockSync.reset();
    clockSync.update({ localSendTime: 3000, localRecvTime: 3200, serverTimestamp: 3050 });

    const rtt = 200;
    const estimatedServerNow = 3050 + rtt / 2;
    const expected = 3200 - estimatedServerNow;
    expect(clockSync.offset).toBe(expected);
  });

  it('handles zero RTT', () => {
    clockSync.update({ localSendTime: 1000, localRecvTime: 1000, serverTimestamp: 1000 });
    expect(clockSync.offset).toBe(0);
  });

  it('handles servers ahead of local clock (negative offset)', () => {
    clockSync.update({ localSendTime: 1000, localRecvTime: 1100, serverTimestamp: 1200 });
    expect(clockSync.offset).toBeLessThan(0);
  });

  it('warns for large offsets (> 30s)', () => {
    const warnSpy = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnSpy.push(args.join(' '));

    clockSync.update({ localSendTime: 0, localRecvTime: 100, serverTimestamp: 50_000 });
    expect(warnSpy.length).toBe(1);
    expect(warnSpy[0]).toContain('Large clock offset');

    console.warn = origWarn;
  });
});
