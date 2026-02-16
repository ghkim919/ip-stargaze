import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebSocket from '@fastify/websocket';
import config from './config.js';
import CaptureManager from './capture/captureManager.js';
import Aggregator from './analysis/aggregator.js';
import WsHandler from './ws/wsHandler.js';
import AgentStore from './remote/agentStore.js';
import RemoteCollector from './remote/remoteCollector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({ logger: false });

const captureManager = new CaptureManager(config.mode);
const aggregator = new Aggregator({
  window: config.defaultWindow,
  subnetLevel: config.defaultSubnetLevel,
});
const wsHandler = new WsHandler({ aggregator, captureManager });

const agentStore = new AgentStore(config.agentsFilePath);
const remoteCollector = new RemoteCollector({
  agentStore,
  pollingIntervalMs: config.defaultPollingIntervalMs,
  pollingTimeoutMs: config.pollingTimeoutMs,
  maxEventsPerPoll: config.maxEventsPerPoll,
  maxAgents: config.maxAgents,
});
wsHandler.setRemoteCollector(remoteCollector);
remoteCollector.start();

await fastify.register(fastifyStatic, {
  root: join(__dirname, '..', 'client'),
  prefix: '/',
});

await fastify.register(fastifyStatic, {
  root: join(__dirname, '..', 'shared'),
  prefix: '/shared/',
  decorateReply: false,
});

await fastify.register(fastifyWebSocket);
wsHandler.register(fastify);

let packetCounter = 0;
captureManager.on('packet', (event) => {
  packetCounter++;
  aggregator.addEvent(event);
});

let snapshotCount = 0;
aggregator.startPeriodicSnapshot((snapshot) => {
  snapshotCount++;
  if (snapshotCount <= 5 || snapshotCount % 10 === 0) {
    console.log(`[snapshot #${snapshotCount}] packets received: ${packetCounter} | aggregated: ${snapshot.summary.totalPackets} | subnets: ${snapshot.subnets.length} | clients: ${wsHandler.clientCount}`);
  }
  wsHandler.broadcastSnapshots();
});

captureManager.start({
  scenario: config.defaultScenario,
  eventsPerSecond: config.eventsPerSecond,
});

const shutdown = async () => {
  console.log('Shutting down...');
  remoteCollector.destroy();
  captureManager.stop();
  aggregator.destroy();
  wsHandler.destroy();
  await fastify.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await fastify.listen({ port: config.port, host: config.host });
  console.log(`IP Stargaze server running at http://localhost:${config.port}`);
  console.log(`Mode: ${config.mode} | Events/sec: ${config.eventsPerSecond}`);
} catch (err) {
  console.error('Failed to start server:', err.message);
  process.exit(1);
}
