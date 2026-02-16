const DEFAULT_LIMIT = 10_000;
const MAX_LIMIT = 50_000;
const VERSION = '0.1.0';

function authenticate(request, reply, apiKey) {
  if (!apiKey) return true;

  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }

  const token = auth.slice(7);
  if (token !== apiKey) {
    reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }

  return true;
}

export default function registerRoutes(fastify, { eventBuffer, agentConfig, captureManager, startTime }) {
  fastify.get('/api/health', async (request, reply) => {
    const stats = eventBuffer.stats();
    return {
      status: 'ok',
      agentId: agentConfig.agentId,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      mode: captureManager.mode,
      interface: agentConfig.interface,
      bufferSize: stats.size,
      bufferCapacity: stats.capacity,
      captureActive: true,
      version: VERSION,
      timestamp: Date.now(),
    };
  });

  fastify.get('/api/events', async (request, reply) => {
    if (!authenticate(request, reply, agentConfig.apiKey)) return;

    const since = parseInt(request.query.since, 10);
    const rawLimit = parseInt(request.query.limit, 10);

    if (request.query.since !== undefined && isNaN(since)) {
      return reply.code(400).send({ error: 'Invalid since parameter' });
    }
    if (request.query.limit !== undefined && (isNaN(rawLimit) || rawLimit < 1)) {
      return reply.code(400).send({ error: 'Invalid limit parameter' });
    }

    const limit = Math.min(rawLimit || DEFAULT_LIMIT, MAX_LIMIT);
    const hasSince = !isNaN(since) && request.query.since !== undefined;

    const { events, gapDetected } = hasSince
      ? eventBuffer.getSince(since, limit)
      : eventBuffer.getAll(limit);

    const stats = eventBuffer.stats();
    const hasMore = events.length > 0
      ? events[events.length - 1].seq < stats.newestSeq
      : false;

    return {
      agentId: agentConfig.agentId,
      sequenceStart: events.length > 0 ? events[0].seq : 0,
      sequenceEnd: events.length > 0 ? events[events.length - 1].seq : 0,
      events,
      hasMore,
      gapDetected,
      serverTimestamp: Date.now(),
    };
  });

  fastify.get('/api/info', async (request, reply) => {
    if (!authenticate(request, reply, agentConfig.apiKey)) return;

    return {
      agentId: agentConfig.agentId,
      hostname: agentConfig.agentId,
      version: VERSION,
      mode: captureManager.mode,
      interface: agentConfig.interface,
      supportedFeatures: ['events', 'health'],
      timestamp: Date.now(),
    };
  });
}
