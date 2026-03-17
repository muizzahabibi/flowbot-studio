import type { RecoveryConfig, RecoveryConfiguredMode, RecoveryEffectiveMode } from './recovery-types.js';

export interface RecoveryConfigEnv {
  FLOW_PLAYWRIGHT_ENABLED?: string;
  FLOW_PLAYWRIGHT_MODE?: string;
  FLOW_PLAYWRIGHT_STORAGE_STATE_PATH?: string;
  FLOW_GOOGLE_COOKIE?: string;
  FLOW_PLAYWRIGHT_TIMEOUT_MS?: string;
  FLOW_PLAYWRIGHT_MANUAL_WAIT_MS?: string;
  FLOW_PLAYWRIGHT_RECOVERY_URL?: string;
  FLOW_PLAYWRIGHT_PROFILE_KEY?: string;
  CI?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MANUAL_WAIT_MS = 120_000;
const DEFAULT_RECOVERY_URL = 'https://labs.google/fx';
const DEFAULT_PROFILE_KEY = 'default';
const DEFAULT_STORAGE_STATE_PATH = '.flow-playwright-state.json';

export function parseRecoveryConfig(env: RecoveryConfigEnv): RecoveryConfig {
  const enabled = parseBoolean(env.FLOW_PLAYWRIGHT_ENABLED);
  const configuredMode = parseMode(env.FLOW_PLAYWRIGHT_MODE);
  const effectiveMode = resolveEffectiveMode(configuredMode, env.CI);
  const timeoutMs = parseNumberEnv('FLOW_PLAYWRIGHT_TIMEOUT_MS', env.FLOW_PLAYWRIGHT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const manualWaitMs = parseNumberEnv(
    'FLOW_PLAYWRIGHT_MANUAL_WAIT_MS',
    env.FLOW_PLAYWRIGHT_MANUAL_WAIT_MS,
    DEFAULT_MANUAL_WAIT_MS,
  );

  const storageStatePath = requireNonEmptyString(
    env.FLOW_PLAYWRIGHT_STORAGE_STATE_PATH,
    'FLOW_PLAYWRIGHT_STORAGE_STATE_PATH is required when Playwright recovery is configured',
    DEFAULT_STORAGE_STATE_PATH,
  );
  const recoveryUrl = parseRecoveryUrl(env.FLOW_PLAYWRIGHT_RECOVERY_URL ?? DEFAULT_RECOVERY_URL);
  const profileKey = requireNonEmptyString(
    env.FLOW_PLAYWRIGHT_PROFILE_KEY,
    'FLOW_PLAYWRIGHT_PROFILE_KEY must be a non-empty string',
    DEFAULT_PROFILE_KEY,
  );

  return {
    enabled,
    configuredMode,
    effectiveMode,
    storageStatePath,
    bootstrapCookie: normalizeOptionalString(env.FLOW_GOOGLE_COOKIE),
    timeoutMs,
    manualWaitMs,
    recoveryUrl,
    profileKey,
  };
}

function parseBoolean(value: string | undefined): boolean {
  if (value == null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseMode(value: string | undefined): RecoveryConfiguredMode {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === 'auto') return 'auto';
  if (normalized === 'headed' || normalized === 'headless') return normalized;
  throw new Error('FLOW_PLAYWRIGHT_MODE must be one of headed, headless, or auto');
}

function resolveEffectiveMode(configuredMode: RecoveryConfiguredMode, ciValue: string | undefined): RecoveryEffectiveMode {
  if (configuredMode === 'headed' || configuredMode === 'headless') return configuredMode;
  return isCi(ciValue) ? 'headless' : 'headed';
}

function isCi(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function parseNumberEnv(name: string, rawValue: string | undefined, fallback: number): number {
  const normalized = normalizeOptionalString(rawValue);
  if (normalized == null) return fallback;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer number of milliseconds`);
  }

  return parsed;
}

function requireNonEmptyString(value: string | undefined, message: string, fallback?: string): string {
  const normalized = normalizeOptionalString(value) ?? fallback;
  if (!normalized) {
    throw new Error(message);
  }
  return normalized;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseRecoveryUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      throw new Error('FLOW_PLAYWRIGHT_RECOVERY_URL must use https');
    }
    return url.toString();
  } catch (error) {
    if (error instanceof Error && error.message === 'FLOW_PLAYWRIGHT_RECOVERY_URL must use https') {
      throw error;
    }
    throw new Error('FLOW_PLAYWRIGHT_RECOVERY_URL must be a valid https URL');
  }
}
