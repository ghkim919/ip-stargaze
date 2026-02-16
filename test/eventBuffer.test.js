import { describe, it, expect, beforeEach } from 'vitest';
import EventBuffer from '../src/agent/eventBuffer.js';

describe('EventBuffer', () => {
  let buffer;

  function createEvent(sourceIp = '192.168.1.1') {
    return {
      sourceIp,
      destPort: 443,
      protocol: 'TCP',
      timestamp: Date.now(),
      bytes: 1000,
    };
  }

  beforeEach(() => {
    buffer = new EventBuffer(5);
  });

  describe('constructor', () => {
    it('creates with specified capacity', () => {
      expect(buffer.capacity).toBe(5);
      expect(buffer.size).toBe(0);
    });

    it('creates with default capacity', () => {
      const defaultBuffer = new EventBuffer();
      expect(defaultBuffer.capacity).toBe(100_000);
    });

    it('enforces minimum capacity of 1', () => {
      const tiny = new EventBuffer(0);
      expect(tiny.capacity).toBe(1);

      const negative = new EventBuffer(-10);
      expect(negative.capacity).toBe(1);
    });
  });

  describe('push', () => {
    it('assigns monotonic sequence numbers starting from 1', () => {
      const seq1 = buffer.push(createEvent());
      const seq2 = buffer.push(createEvent());
      const seq3 = buffer.push(createEvent());

      expect(seq1).toBe(1);
      expect(seq2).toBe(2);
      expect(seq3).toBe(3);
    });

    it('includes seq in stored events', () => {
      buffer.push(createEvent('10.0.0.1'));
      const { events } = buffer.getAll();

      expect(events[0].seq).toBe(1);
      expect(events[0].sourceIp).toBe('10.0.0.1');
    });

    it('tracks size correctly', () => {
      buffer.push(createEvent());
      expect(buffer.size).toBe(1);

      buffer.push(createEvent());
      buffer.push(createEvent());
      expect(buffer.size).toBe(3);
    });

    it('does not exceed capacity', () => {
      for (let i = 0; i < 10; i++) {
        buffer.push(createEvent());
      }
      expect(buffer.size).toBe(5);
    });
  });

  describe('overflow', () => {
    it('discards oldest events when buffer is full (AC-111)', () => {
      for (let i = 1; i <= 7; i++) {
        buffer.push(createEvent(`10.0.0.${i}`));
      }

      const { events } = buffer.getSince(0);
      expect(events.length).toBe(5);
      expect(events[0].seq).toBe(3);
      expect(events[4].seq).toBe(7);
    });

    it('maintains correct oldest/newest seq after overflow', () => {
      for (let i = 1; i <= 7; i++) {
        buffer.push(createEvent());
      }

      expect(buffer.oldestSeq).toBe(3);
      expect(buffer.newestSeq).toBe(7);
    });

    it('returns only recent events after large overflow (AC-104)', () => {
      const large = new EventBuffer(100);
      for (let i = 0; i < 150; i++) {
        large.push(createEvent(`10.0.${Math.floor(i / 256)}.${i % 256}`));
      }

      const { events } = large.getAll();
      expect(events.length).toBe(100);
      expect(events[0].seq).toBe(51);
      expect(events[99].seq).toBe(150);
    });
  });

  describe('getSince', () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) {
        buffer.push(createEvent(`10.0.0.${i}`));
      }
    });

    it('returns events after specified seq (AC-102)', () => {
      const buf10 = new EventBuffer(10);
      for (let i = 1; i <= 10; i++) {
        buf10.push(createEvent(`10.0.0.${i}`));
      }

      const { events } = buf10.getSince(5);
      expect(events.length).toBe(5);
      expect(events[0].seq).toBe(6);
      expect(events[4].seq).toBe(10);
    });

    it('respects limit parameter (AC-112)', () => {
      const buf20 = new EventBuffer(20);
      for (let i = 1; i <= 20; i++) {
        buf20.push(createEvent());
      }

      const { events } = buf20.getSince(10, 3);
      expect(events.length).toBe(3);
      expect(events[0].seq).toBe(11);
      expect(events[2].seq).toBe(13);
    });

    it('returns empty array for empty buffer (AC-113)', () => {
      const empty = new EventBuffer(5);
      const { events, gapDetected } = empty.getSince(0);

      expect(events).toEqual([]);
      expect(gapDetected).toBe(false);
    });

    it('returns empty array when since >= newestSeq', () => {
      const { events } = buffer.getSince(5);
      expect(events).toEqual([]);

      const { events: events2 } = buffer.getSince(100);
      expect(events2).toEqual([]);
    });

    it('returns all events when since is 0', () => {
      const { events } = buffer.getSince(0);
      expect(events.length).toBe(5);
      expect(events[0].seq).toBe(1);
      expect(events[4].seq).toBe(5);
    });
  });

  describe('gapDetected', () => {
    it('sets gapDetected when since is before oldest seq (AC-105)', () => {
      for (let i = 1; i <= 10; i++) {
        buffer.push(createEvent());
      }

      const { events, gapDetected } = buffer.getSince(2);
      expect(gapDetected).toBe(true);
      expect(events.length).toBe(5);
      expect(events[0].seq).toBe(6);
    });

    it('does not set gapDetected when since is within range', () => {
      for (let i = 1; i <= 3; i++) {
        buffer.push(createEvent());
      }

      const { gapDetected } = buffer.getSince(1);
      expect(gapDetected).toBe(false);
    });

    it('does not set gapDetected when since is 0', () => {
      for (let i = 1; i <= 10; i++) {
        buffer.push(createEvent());
      }

      const { gapDetected } = buffer.getSince(0);
      expect(gapDetected).toBe(false);
    });

    it('sets gapDetected when since equals oldest - 2', () => {
      for (let i = 1; i <= 10; i++) {
        buffer.push(createEvent());
      }
      // oldest is 6, since=4 means 4 < 6-1=5, so gap
      const { gapDetected } = buffer.getSince(4);
      expect(gapDetected).toBe(true);
    });

    it('does not set gapDetected when since equals oldest - 1', () => {
      for (let i = 1; i <= 10; i++) {
        buffer.push(createEvent());
      }
      // oldest is 6, since=5 means 5 < 6-1=5 is false, no gap
      const { gapDetected } = buffer.getSince(5);
      expect(gapDetected).toBe(false);
    });
  });

  describe('getAll', () => {
    it('returns all events with limit', () => {
      for (let i = 1; i <= 5; i++) {
        buffer.push(createEvent());
      }

      const { events } = buffer.getAll(3);
      expect(events.length).toBe(3);
      expect(events[0].seq).toBe(1);
      expect(events[2].seq).toBe(3);
    });

    it('returns all events when limit exceeds size', () => {
      buffer.push(createEvent());
      buffer.push(createEvent());

      const { events } = buffer.getAll(100);
      expect(events.length).toBe(2);
    });
  });

  describe('stats', () => {
    it('returns correct stats for empty buffer', () => {
      const stats = buffer.stats();
      expect(stats).toEqual({
        size: 0,
        capacity: 5,
        oldestSeq: 0,
        newestSeq: 0,
      });
    });

    it('returns correct stats for partially filled buffer', () => {
      buffer.push(createEvent());
      buffer.push(createEvent());

      const stats = buffer.stats();
      expect(stats).toEqual({
        size: 2,
        capacity: 5,
        oldestSeq: 1,
        newestSeq: 2,
      });
    });

    it('returns correct stats after overflow', () => {
      for (let i = 1; i <= 8; i++) {
        buffer.push(createEvent());
      }

      const stats = buffer.stats();
      expect(stats).toEqual({
        size: 5,
        capacity: 5,
        oldestSeq: 4,
        newestSeq: 8,
      });
    });
  });

  describe('event data integrity', () => {
    it('preserves all original event fields', () => {
      const original = {
        sourceIp: '203.0.113.45',
        destPort: 8080,
        protocol: 'UDP',
        timestamp: 1700000000000,
        bytes: 512,
      };

      buffer.push(original);
      const { events } = buffer.getAll();

      expect(events[0].sourceIp).toBe('203.0.113.45');
      expect(events[0].destPort).toBe(8080);
      expect(events[0].protocol).toBe('UDP');
      expect(events[0].timestamp).toBe(1700000000000);
      expect(events[0].bytes).toBe(512);
      expect(events[0].seq).toBe(1);
    });

    it('does not share references with pushed events', () => {
      const event = createEvent();
      buffer.push(event);
      event.sourceIp = 'modified';

      const { events } = buffer.getAll();
      expect(events[0].sourceIp).toBe('192.168.1.1');
    });
  });

  describe('capacity 1 edge case', () => {
    it('works correctly with capacity of 1', () => {
      const tiny = new EventBuffer(1);

      tiny.push(createEvent('1.1.1.1'));
      expect(tiny.size).toBe(1);
      expect(tiny.oldestSeq).toBe(1);

      tiny.push(createEvent('2.2.2.2'));
      expect(tiny.size).toBe(1);
      expect(tiny.oldestSeq).toBe(2);
      expect(tiny.newestSeq).toBe(2);

      const { events } = tiny.getAll();
      expect(events.length).toBe(1);
      expect(events[0].sourceIp).toBe('2.2.2.2');
    });
  });
});
