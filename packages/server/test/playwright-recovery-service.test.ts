import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaywrightRecoveryService } from '../src/services/playwright-recovery-service.js';
import type { BrowserContextCookie, RecoveryConfig, RecoveryInput } from '../src/services/recovery-types.js';
import type { PlaywrightStorageState } from '../src/services/recovery-state-store.js';

describe('PlaywrightRecoveryService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns recovery failed without launching Chromium when recovery is disabled', async () => {
    const browser = createBrowserMock([() => createContextMock()]);
    const service = new PlaywrightRecoveryService({
      config: createConfig({ enabled: false, effectiveMode: 'headless' }),
      stateStore: createStateStore(),
      playwright: createPlaywright(browser),
    });

    const result = await service.recover({
      cookieDomain: '.google.com',
      success: vi.fn().mockResolvedValue(true),
    });

    expect(browser.newContext).not.toHaveBeenCalled();
    expect(result).toEqual({
      storageStateUpdated: false,
      manualActionRequired: false,
      recoveryAttempted: false,
      code: 'FLOW_PLAYWRIGHT_RECOVERY_FAILED',
    });
  });

  it('falls back from invalid saved state to bootstrap cookie and returns recovered cookie header', async () => {
    const stateStore = createStateStore({
      load: vi.fn().mockResolvedValue({ cookies: [], origins: [] } satisfies PlaywrightStorageState),
      quarantine: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    });

    const fallbackContext = createContextMock({
      cookies: [
        { name: 'SID', value: 'sid-recovered', domain: '.google.com', path: '/', secure: true, httpOnly: true },
        { name: 'HSID', value: 'hsid-recovered', domain: '.google.com', path: '/', secure: true, httpOnly: true },
      ],
    });

    const browser = createBrowserMock([
      () => {
        throw new Error('saved state rejected');
      },
      () => fallbackContext,
    ]);

    const service = new PlaywrightRecoveryService({
      config: createConfig({ effectiveMode: 'headless', bootstrapCookie: 'SID=seed-sid; HSID=seed-hsid' }),
      stateStore,
      playwright: createPlaywright(browser),
    });

    const result = await service.recover({
      cookieDomain: '.google.com',
      success: vi.fn().mockResolvedValue(true),
    });

    expect(stateStore.quarantine).toHaveBeenCalledWith('Saved Playwright storage state was rejected by browser context creation');
    expect(browser.newContext).toHaveBeenNthCalledWith(1, { storageState: { cookies: [], origins: [] } });
    expect(browser.newContext).toHaveBeenNthCalledWith(2)
    expect(fallbackContext.addCookies).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'SID', value: 'seed-sid', domain: '.google.com' }),
      expect.objectContaining({ name: 'HSID', value: 'seed-hsid', domain: '.google.com' }),
    ]);
    expect(result).toEqual({
      recoveredCookieHeader: 'SID=sid-recovered; HSID=hsid-recovered',
      storageStateUpdated: true,
      manualActionRequired: false,
      recoveryAttempted: true,
    });
    expect(stateStore.save).toHaveBeenCalledWith({ cookies: fallbackContext.cookieJar, origins: [] });
  });

  it('quarantines stale saved state and falls back to bootstrap cookies when explicit success fails', async () => {
    const stateStore = createStateStore({
      load: vi.fn().mockResolvedValue({ cookies: [], origins: [] } satisfies PlaywrightStorageState),
      quarantine: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    });
    const savedContext = createContextMock();
    const fallbackContext = createContextMock({
      cookies: [
        { name: 'SID', value: 'sid-recovered', domain: '.google.com', path: '/', secure: true, httpOnly: true },
        { name: 'HSID', value: 'hsid-recovered', domain: '.google.com', path: '/', secure: true, httpOnly: true },
      ],
    });
    const success = vi
      .fn<RecoveryInput['success']>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const browser = createBrowserMock([() => savedContext, () => fallbackContext]);

    const service = new PlaywrightRecoveryService({
      config: createConfig({ effectiveMode: 'headless', bootstrapCookie: 'SID=seed-sid; HSID=seed-hsid' }),
      stateStore,
      playwright: createPlaywright(browser),
    });

    const result = await service.recover({
      cookieDomain: '.google.com',
      success,
    });

    expect(success).toHaveBeenCalledTimes(2);
    expect(stateStore.quarantine).toHaveBeenCalledWith(
      'Saved Playwright storage state did not yield a valid recovered cookie header',
    );
    expect(browser.newContext).toHaveBeenNthCalledWith(1, { storageState: { cookies: [], origins: [] } });
    expect(browser.newContext).toHaveBeenNthCalledWith(2)
    expect(fallbackContext.addCookies).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'SID', value: 'seed-sid', domain: '.google.com' }),
      expect.objectContaining({ name: 'HSID', value: 'seed-hsid', domain: '.google.com' }),
    ]);
    expect(result).toEqual({
      recoveredCookieHeader: 'SID=sid-recovered; HSID=hsid-recovered',
      storageStateUpdated: true,
      manualActionRequired: false,
      recoveryAttempted: true,
    });
    expect(stateStore.save).toHaveBeenCalledWith({ cookies: fallbackContext.cookieJar, origins: [] });
  });

  it('requires explicit success signals instead of treating page load as success', async () => {
    const context = createContextMock({
      cookies: [
        { name: 'SID', value: 'sid-recovered', domain: '.google.com', path: '/', secure: true, httpOnly: true },
        { name: 'HSID', value: 'hsid-recovered', domain: '.google.com', path: '/', secure: true, httpOnly: true },
      ],
    });

    const service = new PlaywrightRecoveryService({
      config: createConfig({ effectiveMode: 'headed', manualWaitMs: 25, bootstrapCookie: 'SID=seed-sid; HSID=seed-hsid' }),
      stateStore: createStateStore(),
      playwright: createPlaywright(createBrowserMock([() => context])),
    });

    const result = await service.recover({
      cookieDomain: '.google.com',
      success: vi.fn().mockResolvedValue(false),
    });

    expect(context.page.goto).toHaveBeenCalledWith('https://labs.google/fx', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(context.page.waitForTimeout).toHaveBeenCalledWith(25);
    expect(result).toEqual({
      storageStateUpdated: false,
      manualActionRequired: false,
      recoveryAttempted: true,
      code: 'FLOW_PLAYWRIGHT_RECOVERY_FAILED',
    });
  });

  it('returns FLOW_MANUAL_BROWSER_ACTION_REQUIRED in headless mode when manual action is needed', async () => {
    const context = createContextMock();
    const success = vi.fn().mockResolvedValue(false);

    const service = new PlaywrightRecoveryService({
      config: createConfig({ effectiveMode: 'headless', bootstrapCookie: 'SID=seed-sid; HSID=seed-hsid' }),
      stateStore: createStateStore(),
      playwright: createPlaywright(createBrowserMock([() => context])),
    });

    const result = await service.recover({
      cookieDomain: '.google.com',
      success,
    });

    expect(success).toHaveBeenCalledTimes(1);
    expect(context.page.waitForTimeout).not.toHaveBeenCalled();
    expect(result).toEqual({
      storageStateUpdated: false,
      manualActionRequired: true,
      recoveryAttempted: true,
      code: 'FLOW_MANUAL_BROWSER_ACTION_REQUIRED',
    });
  });

  it('returns FLOW_PLAYWRIGHT_RECOVERY_FAILED after headed manual timeout', async () => {
    const context = createContextMock();
    const success = vi.fn().mockResolvedValue(false);

    const service = new PlaywrightRecoveryService({
      config: createConfig({ effectiveMode: 'headed', manualWaitMs: 1234, bootstrapCookie: 'SID=seed-sid; HSID=seed-hsid' }),
      stateStore: createStateStore(),
      playwright: createPlaywright(createBrowserMock([() => context])),
    });

    const result = await service.recover({
      cookieDomain: '.google.com',
      success,
    });

    expect(success).toHaveBeenCalledTimes(2);
    expect(context.page.waitForTimeout).toHaveBeenCalledWith(1234);
    expect(result).toEqual({
      storageStateUpdated: false,
      manualActionRequired: false,
      recoveryAttempted: true,
      code: 'FLOW_PLAYWRIGHT_RECOVERY_FAILED',
    });
  });

  it('succeeds when only one required auth cookie rotates and the final jar still contains both', async () => {
    const stateStore = createStateStore({ save: vi.fn().mockResolvedValue(undefined) });
    const context = createContextMock({
      cookies: [
        { name: 'SID', value: 'sid-rotated', domain: '.google.com', path: '/', secure: true, httpOnly: true },
        { name: 'HSID', value: 'seed-hsid', domain: '.google.com', path: '/', secure: true, httpOnly: true },
      ],
    });

    const service = new PlaywrightRecoveryService({
      config: createConfig({ effectiveMode: 'headless', bootstrapCookie: 'SID=seed-sid; HSID=seed-hsid' }),
      stateStore,
      playwright: createPlaywright(createBrowserMock([() => context])),
    });

    const result = await service.recover({
      cookieDomain: '.google.com',
      success: vi.fn().mockResolvedValue(true),
    });

    expect(result).toEqual({
      recoveredCookieHeader: 'SID=sid-rotated; HSID=seed-hsid',
      storageStateUpdated: true,
      manualActionRequired: false,
      recoveryAttempted: true,
    });
    expect(stateStore.save).toHaveBeenCalledWith({ cookies: context.cookieJar, origins: [] });
  });

  it('fails when recovered browser state cannot produce the required auth cookie subset', async () => {
    const stateStore = createStateStore({ save: vi.fn().mockResolvedValue(undefined) });
    const context = createContextMock({
      cookies: [{ name: 'SID', value: 'sid-only', domain: '.google.com', path: '/', secure: true, httpOnly: true }],
    });

    const service = new PlaywrightRecoveryService({
      config: createConfig({ effectiveMode: 'headless', bootstrapCookie: undefined }),
      stateStore,
      playwright: createPlaywright(createBrowserMock([() => context])),
    });

    const result = await service.recover({
      cookieDomain: '.google.com',
      success: vi.fn().mockResolvedValue(true),
    });

    expect(result).toEqual({
      storageStateUpdated: false,
      manualActionRequired: false,
      recoveryAttempted: true,
      code: 'FLOW_PLAYWRIGHT_RECOVERY_FAILED',
    });
    expect(stateStore.save).not.toHaveBeenCalled();
  });

  it('rethrows saved-state recovery flow errors without quarantining the saved state', async () => {
    const stateStore = createStateStore({
      load: vi.fn().mockResolvedValue({ cookies: [], origins: [] } satisfies PlaywrightStorageState),
    });
    const context = createContextMock();
    const browser = createBrowserMock([() => context]);
    const error = new Error('page open failed');
    context.newPage.mockRejectedValueOnce(error);

    const service = new PlaywrightRecoveryService({
      config: createConfig({ effectiveMode: 'headless', bootstrapCookie: 'SID=seed-sid; HSID=seed-hsid' }),
      stateStore,
      playwright: createPlaywright(browser),
    });

    await expect(
      service.recover({
        cookieDomain: '.google.com',
        success: vi.fn().mockResolvedValue(true),
      }),
    ).rejects.toThrow(error);

    expect(stateStore.quarantine).not.toHaveBeenCalled();
    expect(browser.newContext).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});

function createConfig(overrides: Partial<RecoveryConfig> = {}): RecoveryConfig {
  return {
    enabled: true,
    configuredMode: 'headless',
    effectiveMode: 'headless',
    storageStatePath: '/tmp/recovery-state.json',
    bootstrapCookie: undefined,
    timeoutMs: 30_000,
    manualWaitMs: 120_000,
    recoveryUrl: 'https://labs.google/fx',
    profileKey: 'default',
    ...overrides,
  };
}

function createStateStore(overrides: Partial<RecoveryStateStoreLike> = {}): RecoveryStateStoreLike {
  return {
    load: vi.fn().mockResolvedValue(undefined),
    quarantine: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createPlaywright(browser: BrowserLike): PlaywrightLike {
  return {
    chromium: {
      launch: vi.fn().mockResolvedValue(browser),
    },
  };
}

function createBrowserMock(contextFactories: Array<() => ContextLike>): BrowserLike {
  const close = vi.fn().mockResolvedValue(undefined);
  const newContext = vi.fn(async () => {
    const next = contextFactories.shift();
    if (!next) {
      throw new Error('No context factory left for test');
    }
    return next();
  });

  return { newContext, close };
}

function createContextMock(input: { cookies?: BrowserContextCookie[] } = {}): ContextLike {
  const cookieJar = [...(input.cookies ?? [])];
  const page = {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
  };

  return {
    cookieJar,
    page,
    addCookies: vi.fn(async (cookies: BrowserContextCookie[]) => {
      cookieJar.push(...cookies);
    }),
    cookies: vi.fn().mockImplementation(async () => [...cookieJar]),
    newPage: vi.fn().mockResolvedValue(page),
    storageState: vi.fn().mockImplementation(async () => ({ cookies: [...cookieJar], origins: [] })),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

interface RecoveryStateStoreLike {
  load(): Promise<PlaywrightStorageState | undefined>;
  quarantine(reason: string): Promise<void>;
  save(state: PlaywrightStorageState): Promise<void>;
}

interface PlaywrightLike {
  chromium: {
    launch: ReturnType<typeof vi.fn>;
  };
}

interface BrowserLike {
  newContext: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

interface ContextLike {
  cookieJar: BrowserContextCookie[];
  page: {
    goto: ReturnType<typeof vi.fn>;
    waitForTimeout: ReturnType<typeof vi.fn>;
  };
  addCookies: ReturnType<typeof vi.fn>;
  cookies: ReturnType<typeof vi.fn>;
  newPage: ReturnType<typeof vi.fn>;
  storageState: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}
