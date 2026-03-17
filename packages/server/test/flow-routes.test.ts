import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { FlowError } from '@flowbot-studio/core';
import { registerErrorHandler } from '../src/middleware/error-handler.js';

const {
  createFlowClientMock,
  initialGenerateMock,
  retryGenerateMock,
  runGenerateWithRecoveryMock,
} = vi.hoisted(() => ({
  createFlowClientMock: vi.fn(),
  initialGenerateMock: vi.fn(),
  retryGenerateMock: vi.fn(),
  runGenerateWithRecoveryMock: vi.fn(),
}));

vi.mock('@flowbot-studio/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@flowbot-studio/core')>();
  return {
    ...actual,
    createFlowClient: createFlowClientMock,
  };
});

describe('registerFlowRoutes', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it('uses an injected recovery orchestrator instead of constructing recovery bootstrap dependencies in the route', async () => {
    runGenerateWithRecoveryMock.mockImplementation(async ({ generate }) =>
      await generate({
        cookieHeader: 'SID=injected; HSID=injected',
        recaptchaToken: 'replacement-token',
      }),
    );

    retryGenerateMock.mockResolvedValueOnce({
      name: 'batches/test',
      generatedImages: [],
    });

    createFlowClientMock.mockImplementation((config?: { cookie?: string }) => ({
      project: () => ({
        generateImageWithReferences: config?.cookie ? retryGenerateMock : initialGenerateMock,
      }),
      media: {
        renameWorkflow: vi.fn(),
      },
    }));

    const { registerFlowRoutes } = await import('../src/routes/flow.js');
    const app = Fastify();
    await registerFlowRoutes(app, {
      recoveryOrchestrator: {
        runGenerateWithRecovery: runGenerateWithRecoveryMock,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/flow/projects/project-123/generate',
      payload: {
        prompt: 'make art',
        recaptcha_token: 'caller-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(runGenerateWithRecoveryMock).toHaveBeenCalledTimes(1);
    expect(createFlowClientMock).toHaveBeenCalledWith({ cookie: 'SID=injected; HSID=injected' });
    expect(retryGenerateMock).toHaveBeenCalledWith('make art', [], {
      recaptchaToken: 'replacement-token',
    });

    await app.close();
  });

  it('passes the caller recaptcha token to the injected recovery orchestrator', async () => {
    runGenerateWithRecoveryMock.mockResolvedValueOnce({
      name: 'batches/test',
      generatedImages: [],
    });

    createFlowClientMock.mockImplementation(() => ({
      project: () => ({
        generateImageWithReferences: initialGenerateMock,
      }),
      media: {
        renameWorkflow: vi.fn(),
      },
    }));

    const { registerFlowRoutes } = await import('../src/routes/flow.js');
    const app = Fastify();
    await registerFlowRoutes(app, {
      recoveryOrchestrator: {
        runGenerateWithRecovery: runGenerateWithRecoveryMock,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/flow/projects/project-123/generate',
      payload: {
        prompt: 'make art',
        recaptcha_token: 'caller-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(runGenerateWithRecoveryMock).toHaveBeenCalledWith({
      recaptchaToken: 'caller-token',
      generate: expect.any(Function),
    });

    await app.close();
  });

  it('returns structured recovery fields from injected recovery orchestrator failures', async () => {
    runGenerateWithRecoveryMock.mockRejectedValueOnce(
      new FlowError('Manual browser action required to complete recovery', {
        code: 'FLOW_MANUAL_BROWSER_ACTION_REQUIRED',
        statusCode: 503,
        retryable: false,
        details: {
          recoveryAttempted: true,
          manualActionRequired: true,
        },
      }),
    );

    const { registerFlowRoutes } = await import('../src/routes/flow.js');
    const app = Fastify();
    registerErrorHandler(app);
    await registerFlowRoutes(app, {
      recoveryOrchestrator: {
        runGenerateWithRecovery: runGenerateWithRecoveryMock,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/flow/projects/project-123/generate',
      payload: {
        prompt: 'make art',
        recaptcha_token: 'caller-token',
      },
    });

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

  it('returns structured generic recovery failure from injected recovery orchestrator failures', async () => {
    runGenerateWithRecoveryMock.mockRejectedValueOnce(
      new FlowError('Playwright recovery failed', {
        code: 'FLOW_PLAYWRIGHT_RECOVERY_FAILED',
        statusCode: 503,
        retryable: false,
        details: {
          recoveryAttempted: true,
          manualActionRequired: false,
        },
      }),
    );

    const { registerFlowRoutes } = await import('../src/routes/flow.js');
    const app = Fastify();
    registerErrorHandler(app);
    await registerFlowRoutes(app, {
      recoveryOrchestrator: {
        runGenerateWithRecovery: runGenerateWithRecoveryMock,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/flow/projects/project-123/generate',
      payload: {
        prompt: 'make art',
        recaptcha_token: 'caller-token',
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        message: 'Playwright recovery failed',
        type: 'upstream_error',
        code: 'FLOW_PLAYWRIGHT_RECOVERY_FAILED',
        retryable: false,
        recoveryAttempted: true,
        manualActionRequired: false,
        recoveryInProgress: false,
      },
    });

    await app.close();
  });
});
