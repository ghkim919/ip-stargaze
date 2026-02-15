const config = {
  mode: process.env.MODE || 'simulation',
  port: parseInt(process.env.PORT, 10) || 15118,
  host: process.env.HOST || '0.0.0.0',
  interface: process.env.INTERFACE || 'eth0',
  eventsPerSecond: Math.max(1, parseInt(process.env.EVENTS_PER_SECOND, 10) || 10),
  defaultWindow: '5m',
  defaultSubnetLevel: '/16',
  defaultScenario: 'normal',
  snapshotIntervalMs: 1000,
  maxSubnetsInSnapshot: 30,
  validWindows: ['1m', '5m', '15m', '1h'],
  validSubnetLevels: ['/8', '/16', '/24'],
  validScenarios: ['normal', 'attack', 'scan'],
};

export default config;
