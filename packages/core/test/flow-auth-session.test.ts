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

  it('maps ACCESS_TOKEN_REFRESH_NEEDED to FLOW_AUTH_REFRESH_NEEDED when no token is returned', async () => {
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

  it('uses returned token even when ACCESS_TOKEN_REFRESH_NEEDED is also present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          error: 'ACCESS_TOKEN_REFRESH_NEEDED',
          access_token: 'fresh-token',
          expires: '2026-03-17T22:37:21.000Z',
          user: {
            name: 'Muizza Habibi',
            email: 'muiza.habibi@gmail.com',
            image: 'https://example.com/avatar.png',
          },
        }),
      }),
    );

    const session = new FlowAuthSession({ cookie: 'SID=test' });

    await expect(session.getAccessToken(true)).resolves.toBe('fresh-token');
  });

  it('refreshes from cookie instead of trusting an injected bearer token when a cookie is available', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'fresh-token',
        expires: '2026-03-17T22:37:21.000Z',
        user: {
          name: 'Muizza Habibi',
          email: 'muiza.habibi@gmail.com',
          image: 'https://example.com/avatar.png',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const session = new FlowAuthSession({ cookie: 'SID=test', bearerToken: 'stale-token' });

    await expect(session.getAccessToken()).resolves.toBe('fresh-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

});
