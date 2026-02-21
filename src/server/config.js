import { AGGREGATOR_DEFAULTS, REMOTE_DEFAULTS } from './config/constants.js';

const config = {
  mode: process.env.MODE || 'simulation',
  port: parseInt(process.env.PORT, 10) || 15118,
  host: process.env.HOST || '0.0.0.0',
  interface: process.env.INTERFACE || 'eth0',
  eventsPerSecond: Math.max(1, parseInt(process.env.EVENTS_PER_SECOND, 10) || 10),
  defaultWindow: '5m',
  defaultSubnetLevel: '/16',
  defaultScenario: 'normal',
  snapshotIntervalMs: AGGREGATOR_DEFAULTS.SNAPSHOT_INTERVAL_MS,
  maxSubnetsInSnapshot: AGGREGATOR_DEFAULTS.MAX_SUBNETS_IN_SNAPSHOT,
  validWindows: ['1m', '5m', '15m', '1h'],
  validSubnetLevels: ['/8', '/16', '/24'],
  validScenarios: ['normal', 'attack', 'scan'],

  agentsFilePath: process.env.AGENTS_FILE || './agents.json',
  defaultPollingIntervalMs: parseInt(process.env.POLLING_INTERVAL, 10) || REMOTE_DEFAULTS.POLLING_INTERVAL_MS,
  pollingTimeoutMs: parseInt(process.env.POLLING_TIMEOUT, 10) || REMOTE_DEFAULTS.POLLING_TIMEOUT_MS,
  maxEventsPerPoll: parseInt(process.env.MAX_EVENTS_PER_POLL, 10) || REMOTE_DEFAULTS.MAX_EVENTS_PER_POLL,
  maxAgents: REMOTE_DEFAULTS.MAX_AGENTS,
};

export default config;
