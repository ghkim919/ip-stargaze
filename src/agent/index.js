import Fastify from 'fastify';
import agentConfig from './agentConfig.js';
import serverConfig from '../server/config.js';
import CaptureManager from '../server/capture/captureManager.js';
import EventBuffer from './eventBuffer.js';
import registerRoutes from './routes.js';

serverConfig.interface = agentConfig.interface;

const fastify = Fastify({ logger: agentConfig.logLevel === 'debug' });
const eventBuffer = new EventBuffer(agentConfig.bufferCapacity);
const captureManager = new CaptureManager(agentConfig.mode);
const startTime = Date.now();

registerRoutes(fastify, { eventBuffer, agentConfig, captureManager, startTime });

captureManager.on('packet', (event) => {
  eventBuffer.push(event);
});

captureManager.start({
  scenario: 'normal',
  eventsPerSecond: 10,
});

const shutdown = async () => {
  console.log('Agent shutting down...');
  captureManager.stop();
  await fastify.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await fastify.listen({ port: agentConfig.port, host: agentConfig.host });
  console.log(`IP Stargaze Agent [${agentConfig.agentId}] running at http://${agentConfig.host}:${agentConfig.port}`);
  console.log(`Mode: ${captureManager.mode} | Buffer: ${agentConfig.bufferCapacity}`);
  if (agentConfig.apiKey) {
    console.log('API key authentication enabled');
  } else {
    console.log('WARNING: No API key configured, endpoints are unprotected');
  }
} catch (err) {
  console.error('Failed to start agent:', err.message);
  process.exit(1);
}
