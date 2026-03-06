import { config as loadEnv } from 'dotenv-safe';
import Fastify from 'fastify';
import { pathToFileURL } from 'node:url';
import { registerOpenAIRoutes } from './routes/openai.js';
import { registerFlowRoutes } from './routes/flow.js';
import { registerErrorHandler } from './middleware/error-handler.js';

export function createServer() {
  try {
    loadEnv({
      allowEmptyValues: true,
      example: '.env.example',
      path: '.env',
    });
  } catch {
    // Optional env file.
  }

  const app = Fastify({
    logger: true,
  });

  app.addHook('onRequest', async (request, reply) => {
    const requestId = request.headers['x-request-id'] ?? crypto.randomUUID();
    reply.header('x-request-id', String(requestId));
  });

  app.get('/health', async () => ({ status: 'ok' }));

  const apiKey = process.env.FLOW_LOCAL_API_KEY;

  const routeOptions = apiKey ? { apiKey } : {};
  void registerOpenAIRoutes(app, routeOptions);
  void registerFlowRoutes(app, routeOptions);

  registerErrorHandler(app);

  app.get('/flow/jobs/:jobId/status', async (request) => {
    const { jobId } = request.params as { jobId: string };
    return {
      jobId,
      status: 'unknown',
      detail: 'SSE/status pipeline is optional and not persisted in this build.',
    };
  });

  return app;
}

export async function startServer(): Promise<void> {
  const app = createServer();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ host: '0.0.0.0', port });
}

const entryArg = process.argv[1];
if (entryArg && import.meta.url === pathToFileURL(entryArg).href) {
  void startServer();
}
