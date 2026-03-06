import { FlowAuthSession } from '../auth/flow-auth-session.js';
import type { FlowClientConfig, FlowRequestOptions } from '../types/flow.js';
import { FlowError } from '../utils/errors.js';
import { defaultLogger, type FlowLogger } from '../utils/logger.js';
import { DEFAULT_RETRY_POLICY, isRetryableStatus, withRetry } from '../utils/retry.js';
import { redactValue } from '../utils/redaction.js';

interface RequestInitEx extends RequestInit {
  skipAuth?: boolean;
}

interface HttpClientOptions {
  config: FlowClientConfig;
  authSession: FlowAuthSession;
  logger?: FlowLogger;
}

export class FlowHttpClient {
  private readonly config: FlowClientConfig;
  private readonly authSession: FlowAuthSession;
  private readonly logger: FlowLogger;
  private readonly apiBaseUrl: string;
  private readonly trpcBaseUrl: string;

  constructor(options: HttpClientOptions) {
    this.config = options.config;
    this.authSession = options.authSession;
    this.logger = options.logger ?? defaultLogger;
    this.apiBaseUrl = (options.config.apiBaseUrl ?? 'https://aisandbox-pa.googleapis.com').replace(/\/$/, '');
    this.trpcBaseUrl = (options.config.trpcBaseUrl ?? 'https://labs.google/fx/api/trpc').replace(/\/$/, '');
  }

  getApiUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${this.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  getTrpcUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${this.trpcBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async get<T>(url: string, init?: RequestInitEx, options?: FlowRequestOptions): Promise<T> {
    return this.request<T>(url, { ...(init ?? {}), method: 'GET' }, options);
  }

  async post<T>(url: string, body: unknown, init?: RequestInitEx, options?: FlowRequestOptions): Promise<T> {
    const headersObj = new Headers(init?.headers ?? {});
    if (!headersObj.has('content-type')) {
      headersObj.set('content-type', 'text/plain;charset=UTF-8');
    }

    return this.request<T>(
      url,
      {
        ...(init ?? {}),
        method: 'POST',
        headers: headersObj,
        body: typeof body === 'string' ? body : JSON.stringify(body),
      },
      options,
    );
  }

  async patch<T>(url: string, body: unknown, init?: RequestInitEx, options?: FlowRequestOptions): Promise<T> {
    const headersObj = new Headers(init?.headers ?? {});
    if (!headersObj.has('content-type')) {
      headersObj.set('content-type', 'text/plain;charset=UTF-8');
    }

    return this.request<T>(
      url,
      {
        ...(init ?? {}),
        method: 'PATCH',
        headers: headersObj,
        body: typeof body === 'string' ? body : JSON.stringify(body),
      },
      options,
    );
  }

  async request<T>(url: string, init: RequestInitEx, options?: FlowRequestOptions): Promise<T> {
    const endpoint = url;
    const timeoutMs = this.resolveTimeout(options?.endpointClass, options?.timeoutMs);
    const retries = options?.retries ?? this.config.retries ?? DEFAULT_RETRY_POLICY.maxRetries;

    return withRetry<T>(
      async () => {
        const token = init.skipAuth ? undefined : await this.authSession.getAccessToken();
        const headers = await this.buildHeaders(init.headers, token, init.skipAuth);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        this.logger.debug('Flow request start', {
          endpoint,
          method: init.method,
          headers: redactValue(headers),
          timeoutMs,
        });

        try {
          const response = await fetch(url, {
            ...init,
            headers,
            signal: controller.signal,
          });

          const text = await response.text();
          const payload = text.length ? this.safeJson(text) : undefined;

          if (!response.ok) {
            this.logger.warn('Flow request failed', {
              endpoint,
              status: response.status,
              body: payload,
            });
            throw new FlowError(
              this.extractMessage(payload) ?? `Request failed (${response.status})`,
              response.status,
              payload ?? text,
              endpoint,
            );
          }

          return (payload ?? {}) as T;
        } catch (error) {
          this.logger.error('Flow request error', {
            endpoint,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        } finally {
          clearTimeout(timer);
        }
      },
      {
        maxRetries: retries,
        baseDelayMs: DEFAULT_RETRY_POLICY.baseDelayMs,
        maxDelayMs: DEFAULT_RETRY_POLICY.maxDelayMs,
      },
      (error) => {
        if (!(error instanceof FlowError)) return false;
        if (error.statusCode === undefined) return false;
        const retryable = isRetryableStatus(error.statusCode);
        this.logger.debug('Flow retry decision', {
          endpoint,
          status: error.statusCode,
          retryable,
          details: redactValue(error.details),
        });
        if (!retryable) {
          this.logger.warn('Request is not retryable', { endpoint, status: error.statusCode });
        }
        return retryable;
      },
      endpoint,
    );
  }

  private async buildHeaders(
    baseHeaders: HeadersInit | undefined,
    accessToken?: string,
    skipAuth = false,
  ): Promise<Record<string, string>> {
    const headersObj = new Headers(baseHeaders ?? {});

    if (!headersObj.has('accept')) headersObj.set('accept', '*/*');
    if (!headersObj.has('accept-language')) {
      headersObj.set('accept-language', 'en-US,en;q=0.9,id-ID;q=0.8,id;q=0.7');
    }
    if (!headersObj.has('origin')) headersObj.set('origin', 'https://labs.google');
    if (!headersObj.has('referer')) headersObj.set('referer', 'https://labs.google/');
    if (!headersObj.has('user-agent')) {
      headersObj.set(
        'user-agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      );
    }

    if (!headersObj.has('sec-ch-ua')) {
      headersObj.set('sec-ch-ua', '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"');
    }
    if (!headersObj.has('sec-ch-ua-mobile')) headersObj.set('sec-ch-ua-mobile', '?0');
    if (!headersObj.has('sec-ch-ua-platform')) headersObj.set('sec-ch-ua-platform', '"Windows"');
    if (!headersObj.has('sec-fetch-dest')) headersObj.set('sec-fetch-dest', 'empty');
    if (!headersObj.has('sec-fetch-mode')) headersObj.set('sec-fetch-mode', 'cors');
    if (!headersObj.has('sec-fetch-site')) headersObj.set('sec-fetch-site', 'cross-site');
    if (!headersObj.has('x-browser-channel')) headersObj.set('x-browser-channel', 'stable');
    if (!headersObj.has('x-browser-copyright')) {
      headersObj.set('x-browser-copyright', 'Copyright 2026 Google LLC. All Rights reserved.');
    }
    if (!headersObj.has('x-browser-validation')) {
      headersObj.set('x-browser-validation', 'mGtxj/IERUi4uQ9hLSvZZF4DQgA=');
    }
    if (!headersObj.has('x-browser-year')) headersObj.set('x-browser-year', '2026');
    if (!headersObj.has('x-client-data')) {
      headersObj.set('x-client-data', 'CK21yQEIlrbJAQimtskBCKmdygEIqujKAQiUocsBCIWgzQEImqzPAQjTsc8B');
    }

    if (!skipAuth && accessToken) {
      headersObj.set('authorization', `Bearer ${accessToken}`);
    }

    const cookie = this.authSession.getCookie();
    if (cookie && !headersObj.has('cookie')) {
      headersObj.set('cookie', cookie);
    }

    const normalized: Record<string, string> = {};
    headersObj.forEach((value, key) => {
      normalized[key] = value;
    });

    return normalized;
  }

  private resolveTimeout(
    endpointClass: FlowRequestOptions['endpointClass'] = 'default',
    override?: number,
  ): number {
    if (override) return override;

    const map = this.config.timeoutMs;
    if (!map) return 30_000;

    if (endpointClass === 'upload') return map.upload ?? map.default ?? 60_000;
    if (endpointClass === 'generate') return map.generate ?? map.default ?? 90_000;
    if (endpointClass === 'fetch') return map.fetch ?? map.default ?? 30_000;

    return map.default ?? 30_000;
  }

  private safeJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private extractMessage(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const p = payload as Record<string, unknown>;
    const err = p.error as Record<string, unknown> | undefined;
    if (err && typeof err.message === 'string') return err.message;
    return undefined;
  }
}
