import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlowAuthSession } from '../src/auth/flow-auth-session.js';
import { FlowAuthError } from '../src/utils/errors.js';

describe('FlowAuthSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('maps missing cookie refresh attempts to FLOW_AUTH_INVALID_COOKIE', async () => {
    const session = new FlowAuthSession({});

    await expect(session.getAccessToken(true)).rejects.toMatchObject({
      name: 'FlowAuthError',
      code: 'FLOW_AUTH_INVALID_COOKIE',
      source: 'auth_session',
      retryable: true,
      message: 'Cookie is required to refresh auth session',
    } satisfies Partial<FlowAuthError>);
  });

  it('rejects forced refresh without a cookie even when a bearer token exists', async () => {
    const session = new FlowAuthSession({ bearerToken: 'token' });

    await expect(session.getAccessToken(true)).rejects.toMatchObject({
      name: 'FlowAuthError',
      code: 'FLOW_AUTH_INVALID_COOKIE',
      source: 'auth_session',
      retryable: true,
      message: 'Cookie is required to refresh auth session',
    } satisfies Partial<FlowAuthError>);
  });

  it('maps ACCESS_TOKEN_REFRESH_NEEDED to FLOW_AUTH_REFRESH_NEEDED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'ACCESS_TOKEN_REFRESH_NEEDED' }),
      }),
    );

    const session = new FlowAuthSession({ cookie: 'SID=test' });

    await expect(session.getAccessToken(true)).rejects.toMatchObject({
      name: 'FlowAuthError',
      code: 'FLOW_AUTH_REFRESH_NEEDED',
      source: 'auth_session',
      retryable: true,
      message: 'Cookie expired. Please provide a new cookie.',
    } satisfies Partial<FlowAuthError>);
  });

});
