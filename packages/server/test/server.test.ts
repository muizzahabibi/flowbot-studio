import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { FlowError } from '@flowbot-studio/core';
import { createServer } from '../src/main.js';
import { registerErrorHandler } from '../src/middleware/error-handler.js';

describe('server', () => {
  it('returns health', async () => {
    const app = createServer();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });

    await app.close();
  });

  it('returns model list', async () => {
    const app = createServer();
    const response = await app.inject({ method: 'GET', url: '/v1/models' });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as { data: Array<{ id: string }> };
    expect(payload.data.length).toBeGreaterThan(0);

    await app.close();
  });

  it('omits optional flow error fields when metadata is undefined', async () => {
    const app = Fastify();
    registerErrorHandler(app);
    app.get('/plain-flow-error', async () => {
      throw new FlowError('plain failure', {
        statusCode: 502,
      });
    });

    const response = await app.inject({ method: 'GET', url: '/plain-flow-error' });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      error: {
        message: 'plain failure',
        type: 'upstream_error',
      },
    });

    await app.close();
  });

  it('returns structured recovery payload fields for recovery flow errors', async () => {
    const app = Fastify();
    registerErrorHandler(app);
    app.get('/recovery-error', async () => {
      throw new FlowError('Manual browser action required to complete recovery', {
        code: 'FLOW_MANUAL_BROWSER_ACTION_REQUIRED',
        statusCode: 503,
        source: 'recovery',
        retryable: false,
        details: {
          recoveryAttempted: true,
          manualActionRequired: true,
        },
      });
    });

    const response = await app.inject({ method: 'GET', url: '/recovery-error' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        message: 'Manual browser action required to complete recovery',
        type: 'upstream_error',
        code: 'FLOW_MANUAL_BROWSER_ACTION_REQUIRED',
        retryable: false,
        recoveryAttempted: true,
        manualActionRequired: true,
        recoveryInProgress: false,
      },
    });

    await app.close();
  });
});
