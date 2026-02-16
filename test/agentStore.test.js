import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AgentStore from '../src/server/remote/agentStore.js';

function tmpFile() {
  return join(tmpdir(), `agents-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

describe('AgentStore', () => {
  let filePath;

  beforeEach(() => {
    filePath = tmpFile();
  });

  afterEach(() => {
    try { unlinkSync(filePath); } catch {}
  });

  it('starts with empty list when file does not exist', () => {
    const store = new AgentStore(filePath);
    expect(store.getAll()).toEqual([]);
    expect(store.size).toBe(0);
  });

  it('adds an agent and persists to file', () => {
    const store = new AgentStore(filePath);
    store.add({ id: 'a1', url: 'http://localhost:15119', apiKey: 'key1', label: 'Test' });

    expect(store.size).toBe(1);
    expect(store.get('a1')).toMatchObject({ id: 'a1', url: 'http://localhost:15119', enabled: true });

    expect(existsSync(filePath)).toBe(true);
    const saved = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(saved.agents).toHaveLength(1);
    expect(saved.agents[0].id).toBe('a1');
  });

  it('loads agents from existing file', () => {
    const data = {
      agents: [
        { id: 'x1', url: 'http://host1:15119', apiKey: 'k1', label: 'Host1', enabled: true },
        { id: 'x2', url: 'http://host2:15119', apiKey: 'k2', label: 'Host2', enabled: false },
      ],
    };
    writeFileSync(filePath, JSON.stringify(data), 'utf-8');

    const store = new AgentStore(filePath);
    expect(store.size).toBe(2);
    expect(store.get('x1').enabled).toBe(true);
    expect(store.get('x2').enabled).toBe(false);
  });

  it('removes an agent', () => {
    const store = new AgentStore(filePath);
    store.add({ id: 'r1', url: 'http://h:1', apiKey: 'k' });
    expect(store.remove('r1')).toBe(true);
    expect(store.size).toBe(0);
    expect(store.get('r1')).toBeNull();
  });

  it('returns false when removing non-existent agent', () => {
    const store = new AgentStore(filePath);
    expect(store.remove('nope')).toBe(false);
  });

  it('enables and disables agents', () => {
    const store = new AgentStore(filePath);
    store.add({ id: 'e1', url: 'http://h:1', apiKey: 'k' });

    expect(store.setEnabled('e1', false)).toBe(true);
    expect(store.get('e1').enabled).toBe(false);

    expect(store.setEnabled('e1', true)).toBe(true);
    expect(store.get('e1').enabled).toBe(true);
  });

  it('returns false when enabling non-existent agent', () => {
    const store = new AgentStore(filePath);
    expect(store.setEnabled('nope', true)).toBe(false);
  });

  it('getEnabled returns only enabled agents', () => {
    const store = new AgentStore(filePath);
    store.add({ id: 'a', url: 'http://h:1', apiKey: 'k', enabled: true });
    store.add({ id: 'b', url: 'http://h:2', apiKey: 'k', enabled: false });
    store.add({ id: 'c', url: 'http://h:3', apiKey: 'k', enabled: true });

    const enabled = store.getEnabled();
    expect(enabled).toHaveLength(2);
    expect(enabled.map((a) => a.id)).toEqual(['a', 'c']);
  });

  it('get returns a copy, not a reference', () => {
    const store = new AgentStore(filePath);
    store.add({ id: 'copy', url: 'http://h:1', apiKey: 'k' });
    const a = store.get('copy');
    a.label = 'modified';
    expect(store.get('copy').label).not.toBe('modified');
  });

  it('handles invalid JSON in file gracefully', () => {
    writeFileSync(filePath, 'not json', 'utf-8');
    const store = new AgentStore(filePath);
    expect(store.size).toBe(0);
  });

  it('handles file with missing agents array', () => {
    writeFileSync(filePath, '{}', 'utf-8');
    const store = new AgentStore(filePath);
    expect(store.size).toBe(0);
  });

  it('defaults label to empty string', () => {
    const store = new AgentStore(filePath);
    store.add({ id: 'd1', url: 'http://h:1', apiKey: 'k' });
    expect(store.get('d1').label).toBe('');
  });

  it('skips agents with missing required fields when loading', () => {
    const data = {
      agents: [
        { id: 'valid', url: 'http://h:1', apiKey: 'k' },
        { id: 'nourl', apiKey: 'k' },
        { url: 'http://h:2', apiKey: 'k' },
      ],
    };
    writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    const store = new AgentStore(filePath);
    expect(store.size).toBe(1);
    expect(store.get('valid')).not.toBeNull();
  });
});
