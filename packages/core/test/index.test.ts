import { afterEach, describe, expect, it, vi } from 'vitest';

const loadEnvMock = vi.fn();

vi.mock('dotenv-safe', () => ({
  config: loadEnvMock,
}));

const ORIGINAL_ENV = {
  FLOW_COOKIE: process.env.FLOW_COOKIE,
  FLOW_GOOGLE_COOKIE: process.env.FLOW_GOOGLE_COOKIE,
  FLOW_BEARER_TOKEN: process.env.FLOW_BEARER_TOKEN,
  FLOW_GOOGLE_API_KEY: process.env.FLOW_GOOGLE_API_KEY,
};

async function importCreateFlowClient(): Promise<(typeof import('../src/index.js'))['createFlowClient']> {
  const mod = await import('../src/index.js');
  return mod.createFlowClient;
}

describe('createFlowClient bootstrap auth config', () => {
  afterEach(() => {
    loadEnvMock.mockReset();
    vi.clearAllMocks();
    vi.resetModules();

    if (ORIGINAL_ENV.FLOW_COOKIE === undefined) {
      delete process.env.FLOW_COOKIE;
    } else {
      process.env.FLOW_COOKIE = ORIGINAL_ENV.FLOW_COOKIE;
    }

    if (ORIGINAL_ENV.FLOW_GOOGLE_COOKIE === undefined) {
      delete process.env.FLOW_GOOGLE_COOKIE;
    } else {
      process.env.FLOW_GOOGLE_COOKIE = ORIGINAL_ENV.FLOW_GOOGLE_COOKIE;
    }

    if (ORIGINAL_ENV.FLOW_BEARER_TOKEN === undefined) {
      delete process.env.FLOW_BEARER_TOKEN;
    } else {
      process.env.FLOW_BEARER_TOKEN = ORIGINAL_ENV.FLOW_BEARER_TOKEN;
    }

    if (ORIGINAL_ENV.FLOW_GOOGLE_API_KEY === undefined) {
      delete process.env.FLOW_GOOGLE_API_KEY;
    } else {
      process.env.FLOW_GOOGLE_API_KEY = ORIGINAL_ENV.FLOW_GOOGLE_API_KEY;
    }
  });

  it('always attempts loadEnv before merging config', async () => {
    delete process.env.FLOW_COOKIE;
    delete process.env.FLOW_GOOGLE_COOKIE;
    delete process.env.FLOW_BEARER_TOKEN;
    delete process.env.FLOW_GOOGLE_API_KEY;

    loadEnvMock.mockImplementation(() => {
      process.env.FLOW_COOKIE = 'loaded-cookie';
    });

    const createFlowClient = await importCreateFlowClient();
    const client = createFlowClient();

    expect(loadEnvMock).toHaveBeenCalledOnce();
    expect(loadEnvMock).toHaveBeenCalledWith({
      allowEmptyValues: true,
      example: '.env.example',
      path: '.env',
    });
    expect(client.authSession.getCookie()).toBe('loaded-cookie');
  });

  it('ignores missing env files while keeping explicit config', async () => {
    const error = new Error("ENOENT: no such file or directory, open '.env'") as Error & { code?: string };
    error.code = 'ENOENT';
    loadEnvMock.mockImplementation(() => {
      throw error;
    });

    const createFlowClient = await importCreateFlowClient();

    expect(createFlowClient({ cookie: 'config-cookie' }).authSession.getCookie()).toBe('config-cookie');
  });

  it('rethrows non-ENOENT dotenv failures', async () => {
    loadEnvMock.mockImplementation(() => {
      throw new Error('invalid dotenv example mismatch');
    });

    const createFlowClient = await importCreateFlowClient();

    expect(() => createFlowClient({ cookie: 'config-cookie' })).toThrow('invalid dotenv example mismatch');
  });

  it('prefers config.cookie, then FLOW_GOOGLE_COOKIE, then FLOW_COOKIE', async () => {
    process.env.FLOW_GOOGLE_COOKIE = 'google-cookie';
    process.env.FLOW_COOKIE = 'legacy-cookie';

    const createFlowClient = await importCreateFlowClient();

    expect(createFlowClient({ cookie: 'config-cookie' }).authSession.getCookie()).toBe('config-cookie');
    expect(createFlowClient().authSession.getCookie()).toBe('google-cookie');

    delete process.env.FLOW_GOOGLE_COOKIE;

    expect(createFlowClient().authSession.getCookie()).toBe('legacy-cookie');
  });
});
