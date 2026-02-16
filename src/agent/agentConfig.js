import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hostname } from 'node:os';

const CONFIG_FILE = 'agent.config.json';

function loadConfigFile() {
  try {
    const filePath = resolve(process.cwd(), CONFIG_FILE);
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function buildConfig() {
  const file = loadConfigFile();

  return {
    agentId: process.env.AGENT_ID || file.agentId || hostname(),
    port: parseInt(process.env.AGENT_PORT, 10) || file.port || 15119,
    host: process.env.AGENT_HOST || file.host || '0.0.0.0',
    mode: process.env.AGENT_MODE || file.mode || 'simulation',
    interface: process.env.AGENT_INTERFACE || file.interface || 'eth0',
    apiKey: process.env.AGENT_API_KEY || file.apiKey || '',
    bufferCapacity: parseInt(process.env.AGENT_BUFFER_CAPACITY, 10) || file.bufferCapacity || 100_000,
    logLevel: process.env.AGENT_LOG_LEVEL || file.logLevel || 'info',
  };
}

const agentConfig = buildConfig();

export default agentConfig;
