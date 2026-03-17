import type { FlowClientConfig, FlowSessionResponse, FlowSessionUser } from '../types/flow.js';
import { FlowAuthError, FlowValidationError } from '../utils/errors.js';
import { defaultLogger, type FlowLogger } from '../utils/logger.js';

interface SessionState {
  accessToken: string | undefined;
  expiresAt: Date | undefined;
  user: FlowSessionUser | undefined;
}

const BOOTSTRAP_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

export class FlowAuthSession {
  private readonly cookie: string | undefined;
  private state: SessionState;
  private readonly logger: FlowLogger;

  constructor(config: FlowClientConfig, logger: FlowLogger = defaultLogger) {
    this.cookie = config.cookie?.trim();
    const bootstrapToken = config.bearerToken?.trim();

    let expiresAt: Date | undefined;
    if (bootstrapToken && !this.cookie) {
      expiresAt = new Date(Date.now() + BOOTSTRAP_TOKEN_TTL_MS);
    }

    this.state = {
      accessToken: bootstrapToken,
      expiresAt,
      user: undefined,
    };
    this.logger = logger;
  }

  hasCookie(): boolean {
    return Boolean(this.cookie);
  }

  getCookie(): string | undefined {
    return this.cookie;
  }

  getUser(): FlowSessionUser | undefined {
    return this.state.user;
  }

  isExpired(bufferMs = 30_000): boolean {
    if (!this.state.accessToken || !this.state.expiresAt) {
      return true;
    }

    return Date.now() + bufferMs >= this.state.expiresAt.getTime();
  }

  async getAccessToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && !this.isExpired()) {
      return this.state.accessToken as string;
    }

    if (!this.cookie) {
      throw new FlowAuthError('Cookie is required to refresh auth session', {
        code: 'FLOW_AUTH_INVALID_COOKIE',
        source: 'auth_session',
        retryable: true,
      });
    }

    await this.refreshFromLabs();

    if (!this.state.accessToken) {
      throw new FlowAuthError('Failed to refresh access token');
    }

    return this.state.accessToken;
  }

  private async refreshFromLabs(): Promise<void> {
    const response = await fetch('https://labs.google/fx/api/auth/session', {
      headers: {
        cookie: this.cookie as string,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error('Auth session refresh failed', { status: response.status, errorBody });
      throw new FlowAuthError(`Authentication failed (${response.status})`, {
        details: errorBody,
      });
    }

    const payload = (await response.json()) as FlowSessionResponse;
    const accessToken = payload.access_token;
    const expires = payload.expires;

    if (payload.error === 'ACCESS_TOKEN_REFRESH_NEEDED' && (!accessToken || !expires)) {
      throw new FlowAuthError('Cookie expired. Please provide a new cookie.', {
        code: 'FLOW_AUTH_REFRESH_NEEDED',
        source: 'auth_session',
        retryable: true,
      });
    }

    if (!accessToken || !expires) {
      throw new FlowValidationError('Invalid auth session payload', payload);
    }

    this.state = {
      accessToken,
      expiresAt: new Date(expires),
      user: payload.user,
    };

    this.logger.debug('Auth session refreshed', {
      expiresAt: this.state.expiresAt?.toISOString(),
      user: this.state.user,
    });
  }
}
