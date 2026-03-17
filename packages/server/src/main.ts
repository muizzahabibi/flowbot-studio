import { FlowError, createFlowClient } from '@flowbot-studio/core';
import { config as loadEnv } from 'dotenv-safe';
import Fastify from 'fastify';
import { pathToFileURL } from 'node:url';
import { registerErrorHandler } from './middleware/error-handler.js';
import { registerFlowRoutes } from './routes/flow.js';
import { registerOpenAIRoutes } from './routes/openai.js';
import { FlowRecoveryOrchestrator } from './services/flow-recovery-orchestrator.js';
import { PlaywrightRecoveryService } from './services/playwright-recovery-service.js';
import { parseRecoveryConfig } from './services/recovery-config.js';

function isRecoverableValidationError(error: unknown): error is FlowError {
  return (
    error instanceof FlowError &&
    (error.code === 'FLOW_AUTH_INVALID_COOKIE' ||
      error.code === 'FLOW_AUTH_REFRESH_NEEDED' ||
      error.code === 'FLOW_CAPTCHA_RELOAD_REQUIRED')
  );
}

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
  const recoveryConfig = parseRecoveryConfig(process.env);
  const recoveryService = new PlaywrightRecoveryService({ config: recoveryConfig });
  const recoveryOrchestrator = new FlowRecoveryOrchestrator({
    profileKey: recoveryConfig.profileKey,
    recover: () =>
      recoveryService.recover({
        cookieDomain: '.google.com',
        success: async ({ recoveredCookieHeader }) => {
          if (!recoveredCookieHeader) {
            return false;
          }

          try {
            await createFlowClient({ cookie: recoveredCookieHeader }).authSession.getAccessToken(true);
            return true;
          } catch (error) {
            if (isRecoverableValidationError(error)) {
              return false;
            }
            throw error;
          }
        },
      }),
  });

  const routeOptions = apiKey ? { apiKey } : {};
  void registerOpenAIRoutes(app, routeOptions);
  void registerFlowRoutes(app, {
    ...routeOptions,
    recoveryOrchestrator,
  });

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
