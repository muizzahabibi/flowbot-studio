export type RecoveryConfiguredMode = 'headed' | 'headless' | 'auto';
export type RecoveryEffectiveMode = 'headed' | 'headless';

export interface RecoveryConfig {
  enabled: boolean;
  configuredMode: RecoveryConfiguredMode;
  effectiveMode: RecoveryEffectiveMode;
  storageStatePath: string;
  bootstrapCookie: string | undefined;
  timeoutMs: number;
  manualWaitMs: number;
  recoveryUrl: string;
  profileKey: string;
}

export interface ParseCookieInput {
  domain: string;
  profileKey: string;
}

export interface BrowserContextCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
}

export interface RecoveredCookie {
  name: string;
  value: string;
  domain?: string;
}

export interface RecoveryInput {
  cookieDomain: string;
  success: (input: { recoveredCookieHeader?: string }) => Promise<boolean>;
}

export interface RecoveryResult {
  recoveredCookieHeader?: string;
  replacementRecaptchaToken?: string;
  storageStateUpdated: boolean;
  manualActionRequired: boolean;
  recoveryAttempted: boolean;
  code?: 'FLOW_MANUAL_BROWSER_ACTION_REQUIRED' | 'FLOW_PLAYWRIGHT_RECOVERY_FAILED';
}
