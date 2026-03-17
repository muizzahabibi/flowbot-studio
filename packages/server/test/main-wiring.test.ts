import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  registerFlowRoutesMock,
  parseRecoveryConfigMock,
  playwrightRecoveryServiceMock,
  flowRecoveryOrchestratorMock,
} = vi.hoisted(() => ({
  registerFlowRoutesMock: vi.fn(async () => undefined),
  parseRecoveryConfigMock: vi.fn(() => ({
    enabled: true,
    configuredMode: 'headless',
    effectiveMode: 'headless',
    storageStatePath: '/tmp/recovery-state.json',
    bootstrapCookie: undefined,
    timeoutMs: 30_000,
    manualWaitMs: 120_000,
    recoveryUrl: 'https://labs.google/fx',
    profileKey: 'server-test',
  })),
  playwrightRecoveryServiceMock: vi.fn(),
  flowRecoveryOrchestratorMock: vi.fn(),
}));

vi.mock('../src/routes/flow.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/routes/flow.js')>();
  return {
    ...actual,
    registerFlowRoutes: registerFlowRoutesMock,
  };
});

vi.mock('../src/services/recovery-config.js', () => ({
  parseRecoveryConfig: parseRecoveryConfigMock,
}));

vi.mock('../src/services/playwright-recovery-service.js', () => ({
  PlaywrightRecoveryService: playwrightRecoveryServiceMock,
}));

vi.mock('../src/services/flow-recovery-orchestrator.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/flow-recovery-orchestrator.js')>();
  return {
    ...actual,
    FlowRecoveryOrchestrator: flowRecoveryOrchestratorMock,
  };
});

describe('createServer wiring', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it('wires recovery dependencies in createServer and injects the orchestrator into flow routes', async () => {
    const recover = vi.fn(async () => ({
      storageStateUpdated: false,
      manualActionRequired: false,
      recoveryAttempted: false,
      code: 'FLOW_PLAYWRIGHT_RECOVERY_FAILED' as const,
    }));
    const recoveryService = { recover };
    const orchestrator = { runGenerateWithRecovery: vi.fn() };

    playwrightRecoveryServiceMock.mockImplementation(() => recoveryService);
    flowRecoveryOrchestratorMock.mockImplementation(() => orchestrator);

    const { createServer } = await import('../src/main.js');
    const app = createServer();

    expect(parseRecoveryConfigMock).toHaveBeenCalledWith(process.env);
    expect(playwrightRecoveryServiceMock).toHaveBeenCalledWith({
      config: parseRecoveryConfigMock.mock.results[0]?.value,
    });
    expect(flowRecoveryOrchestratorMock).toHaveBeenCalledTimes(1);
    expect(flowRecoveryOrchestratorMock).toHaveBeenCalledWith({
      profileKey: 'server-test',
      recover: expect.any(Function),
    });
    expect(registerFlowRoutesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recoveryOrchestrator: orchestrator,
      }),
    );

    const recoverFactory = flowRecoveryOrchestratorMock.mock.calls[0]?.[0]?.recover as (() => Promise<unknown>) | undefined;
    expect(recoverFactory).toBeTypeOf('function');
    await expect(recoverFactory?.()).resolves.toEqual({
      storageStateUpdated: false,
      manualActionRequired: false,
      recoveryAttempted: false,
      code: 'FLOW_PLAYWRIGHT_RECOVERY_FAILED',
    });
    expect(recover).toHaveBeenCalledWith({
      cookieDomain: '.google.com',
      success: expect.any(Function),
    });

    await app.close();
  });
});
