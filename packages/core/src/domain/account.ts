import type { FlowClientConfig } from '../types/flow.js';
import { FlowAuthSession } from '../auth/flow-auth-session.js';
import { FlowValidationError } from '../utils/errors.js';

export class Account {
  readonly authSession: FlowAuthSession;
  readonly config: FlowClientConfig;

  constructor(config: FlowClientConfig) {
    if (!config.cookie?.trim() && !config.bearerToken?.trim()) {
      throw new FlowValidationError('Either cookie or bearer token must be provided');
    }

    this.config = config;
    this.authSession = new FlowAuthSession(config);
  }

  async getToken(forceRefresh = false): Promise<string> {
    return this.authSession.getAccessToken(forceRefresh);
  }

  getCookie(): string | undefined {
    return this.authSession.getCookie();
  }

  isTokenExpired(): boolean {
    return this.authSession.isExpired();
  }
}
