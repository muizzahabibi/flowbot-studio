import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { FlowError } from '@flowbot-studio/core';
import { registerErrorHandler } from '../src/middleware/error-handler.js';

const {
  createFlowClientMock,
  createProjectMock,
  fetchMediaBytesMock,
  initialGenerateMock,
  retryGenerateMock,
  runGenerateWithRecoveryMock,
} = vi.hoisted(() => ({
  createFlowClientMock: vi.fn(),
  createProjectMock: vi.fn(),
  fetchMediaBytesMock: vi.fn(),
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

function createFlowClientValue(overrides: {
  generateImageWithReferences?: typeof initialGenerateMock;
  renameWorkflow?: ReturnType<typeof vi.fn>;
} = {}): {
  project: () => {
    generateImageWithReferences: typeof initialGenerateMock;
  };
  createProject: typeof createProjectMock;
  media: {
    renameWorkflow: ReturnType<typeof vi.fn>;
    save: typeof fetchMediaBytesMock;
  };
} {
  return {
    project: () => ({
      generateImageWithReferences: overrides.generateImageWithReferences ?? initialGenerateMock,
    }),
    createProject: createProjectMock,
    media: {
      renameWorkflow: overrides.renameWorkflow ?? vi.fn(),
      save: fetchMediaBytesMock,
    },
  };
}

async function createApp(
  options: Parameters<(typeof import('../src/routes/flow.js'))['registerFlowRoutes']>[1],
): Promise<FastifyInstance> {
  const { registerFlowRoutes } = await import('../src/routes/flow.js');
  const app = Fastify();
  await registerFlowRoutes(app, options);
  return app;
}

function createGeneratePayload(): {
  prompt: string;
  recaptcha_token: string;
} {
  return {
    prompt: 'make art',
    recaptcha_token: 'caller-token',
  };
}

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

    createFlowClientMock.mockImplementation((config?: { cookie?: string }) =>
      createFlowClientValue({
        generateImageWithReferences: config?.cookie ? retryGenerateMock : initialGenerateMock,
      }),
    );

    const app = await createApp({
      recoveryOrchestrator: {
        runGenerateWithRecovery: runGenerateWithRecoveryMock,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/flow/projects/project-123/generate',
      payload: createGeneratePayload(),
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

    createFlowClientMock.mockReturnValue(createFlowClientValue());

    const app = await createApp({
      recoveryOrchestrator: {
        runGenerateWithRecovery: runGenerateWithRecoveryMock,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/flow/projects/project-123/generate',
      payload: createGeneratePayload(),
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

    const app = Fastify();
    registerErrorHandler(app);
    const { registerFlowRoutes } = await import('../src/routes/flow.js');
    await registerFlowRoutes(app, {
      recoveryOrchestrator: {
        runGenerateWithRecovery: runGenerateWithRecoveryMock,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/flow/projects/project-123/generate',
      payload: createGeneratePayload(),
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

    const app = Fastify();
    registerErrorHandler(app);
    const { registerFlowRoutes } = await import('../src/routes/flow.js');
    await registerFlowRoutes(app, {
      recoveryOrchestrator: {
        runGenerateWithRecovery: runGenerateWithRecoveryMock,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/flow/projects/project-123/generate',
      payload: createGeneratePayload(),
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

  it('creates a project through the server route and returns the project id', async () => {
    createProjectMock.mockResolvedValueOnce({ projectId: 'project-created-123' });

    createFlowClientMock.mockReturnValue(createFlowClientValue());

    const app = await createApp({});

    const response = await app.inject({
      method: 'POST',
      url: '/flow/projects',
      payload: {
        displayName: 'pool-auto-20260317-120000',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(createProjectMock).toHaveBeenCalledWith('pool-auto-20260317-120000');
    expect(response.json()).toEqual({ projectId: 'project-created-123' });

    await app.close();
  });

  it('downloads media bytes through the server route', async () => {
    fetchMediaBytesMock.mockResolvedValueOnce(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    createFlowClientMock.mockReturnValue(createFlowClientValue());

    const app = await createApp({});

    const response = await app.inject({
      method: 'GET',
      url: '/flow/media/media-123/content',
    });

    expect(response.statusCode).toBe(200);
    expect(fetchMediaBytesMock).toHaveBeenCalledWith('media-123');
    expect(response.body).toBe(Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('utf8'));

    await app.close();
  });
});
