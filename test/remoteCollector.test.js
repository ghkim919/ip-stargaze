import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AgentStore from '../src/server/remote/agentStore.js';
import RemoteCollector from '../src/server/remote/remoteCollector.js';

function tmpFile() {
  return join(tmpdir(), `agents-rc-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

describe('RemoteCollector', () => {
  let filePath;
  let store;

  beforeEach(() => {
    filePath = tmpFile();
    store = new AgentStore(filePath);
  });

  afterEach(() => {
    try { unlinkSync(filePath); } catch {}
  });

  it('initializes with empty agent list', () => {
    const collector = new RemoteCollector({ agentStore: store });
    expect(collector.getAgents()).toEqual([]);
    collector.destroy();
  });

  it('getAgents returns agents without apiKey', () => {
    store.add({ id: 'a1', url: 'http://h:1', apiKey: 'secret', label: 'Test' });
    const collector = new RemoteCollector({ agentStore: store });
    const agents = collector.getAgents();

    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('a1');
    expect(agents[0].apiKey).toBeUndefined();

    collector.destroy();
  });

  it('removes an agent', () => {
    store.add({ id: 'r1', url: 'http://h:1', apiKey: 'k' });
    const collector = new RemoteCollector({ agentStore: store });

    expect(collector.removeAgent('r1')).toBe(true);
    expect(collector.getAgents()).toHaveLength(0);

    collector.destroy();
  });

  it('enables and disables agents', () => {
    store.add({ id: 'e1', url: 'http://h:1', apiKey: 'k', enabled: true });
    const collector = new RemoteCollector({ agentStore: store });

    expect(collector.setAgentEnabled('e1', false)).toBe(true);
    const agents = collector.getAgents();
    expect(agents[0].enabled).toBe(false);

    collector.destroy();
  });

  it('returns false for enabling non-existent agent', () => {
    const collector = new RemoteCollector({ agentStore: store });
    expect(collector.setAgentEnabled('nope', true)).toBe(false);
    collector.destroy();
  });

  it('respects maxAgents limit', async () => {
    const collector = new RemoteCollector({
      agentStore: store,
      maxAgents: 1,
    });

    store.add({ id: 'first', url: 'http://h:1', apiKey: 'k' });

    const result = await collector.addAgent({ url: 'http://h:2', apiKey: 'k2' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum agent limit');

    collector.destroy();
  });

  it('start and stop manage polling timer', () => {
    const collector = new RemoteCollector({ agentStore: store });

    collector.start();
    collector.stop();
    collector.destroy();
  });

  it('destroy stops and clears connections', () => {
    store.add({ id: 'd1', url: 'http://h:1', apiKey: 'k' });
    const collector = new RemoteCollector({ agentStore: store });
    collector.start();
    collector.destroy();

    expect(collector.getAgents()).toHaveLength(1);
  });

  it('testAgent handles connection failure', async () => {
    const collector = new RemoteCollector({
      agentStore: store,
      pollingTimeoutMs: 500,
    });

    const result = await collector.testAgent('http://localhost:1', '');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    collector.destroy();
  });

  it('loads pre-existing enabled agents from store', () => {
    store.add({ id: 'pre1', url: 'http://h:1', apiKey: 'k', enabled: true });
    store.add({ id: 'pre2', url: 'http://h:2', apiKey: 'k', enabled: false });

    const collector = new RemoteCollector({ agentStore: store });
    const agents = collector.getAgents();

    const pre1 = agents.find((a) => a.id === 'pre1');
    const pre2 = agents.find((a) => a.id === 'pre2');
    expect(pre1).toBeDefined();
    expect(pre2).toBeDefined();
    expect(pre2.status).toBe('offline');

    collector.destroy();
  });
});
