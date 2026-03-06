import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlowHttpClient } from '../src/client/flow-http-client.js';
import type { FlowClientConfig } from '../src/types/flow.js';

describe('FlowHttpClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('preserves explicit content-type header on post', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '{}',
    });
    vi.stubGlobal('fetch', fetchMock);

    const authSession = {
      getAccessToken: vi.fn().mockResolvedValue('token'),
      getCookie: vi.fn().mockReturnValue('SID=test'),
    } as any;

    const client = new FlowHttpClient({
      config: {} as FlowClientConfig,
      authSession,
    });

    await client.post(
      'https://example.com/test',
      { hello: 'world' },
      {
        skipAuth: true,
        headers: { 'content-type': 'application/json' },
      },
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
  });

  it('uses text/plain default content-type when none provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '{}',
    });
    vi.stubGlobal('fetch', fetchMock);

    const authSession = {
      getAccessToken: vi.fn().mockResolvedValue('token'),
      getCookie: vi.fn().mockReturnValue('SID=test'),
    } as any;

    const client = new FlowHttpClient({
      config: {} as FlowClientConfig,
      authSession,
    });

    await client.post('https://example.com/test', { hello: 'world' }, { skipAuth: true });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('text/plain;charset=UTF-8');
  });
});
