import type { FlowClientConfig, FlowSessionResponse, FlowSessionUser } from '../types/flow.js';
import { FlowAuthError, FlowValidationError } from '../utils/errors.js';
import { defaultLogger, type FlowLogger } from '../utils/logger.js';

interface SessionState {
  accessToken: string | undefined;
  expiresAt: Date | undefined;
  user: FlowSessionUser | undefined;
}

export class FlowAuthSession {
  private readonly cookie: string | undefined;
  private state: SessionState;
  private readonly logger: FlowLogger;

  constructor(config: FlowClientConfig, logger: FlowLogger = defaultLogger) {
    this.cookie = config.cookie?.trim();
    this.state = {
      accessToken: config.bearerToken?.trim(),
      expiresAt: config.bearerToken ? new Date(Date.now() + 2 * 60 * 60 * 1000) : undefined,
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
      if (this.state.accessToken) {
        return this.state.accessToken;
      }
      throw new FlowAuthError('Cookie is required to refresh auth session');
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
      throw new FlowAuthError(`Authentication failed (${response.status})`, errorBody);
    }

    const payload = (await response.json()) as FlowSessionResponse;

    if (payload.error === 'ACCESS_TOKEN_REFRESH_NEEDED') {
      throw new FlowAuthError('Cookie expired. Please provide a new cookie.');
    }

    if (!payload.access_token || !payload.expires) {
      throw new FlowValidationError('Invalid auth session payload', payload);
    }

    this.state = {
      accessToken: payload.access_token,
      expiresAt: new Date(payload.expires),
      user: payload.user,
    };

    this.logger.debug('Auth session refreshed', {
      expiresAt: this.state.expiresAt?.toISOString(),
      user: this.state.user,
    });
  }
}
