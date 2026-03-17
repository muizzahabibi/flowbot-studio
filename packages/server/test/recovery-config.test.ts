import { describe, expect, it } from 'vitest';
import { parseRecoveryConfig } from '../src/services/recovery-config.js';

describe('recovery-config', () => {
  it('resolves auto mode to headless when CI is enabled', () => {
    expect(
      parseRecoveryConfig({
        FLOW_PLAYWRIGHT_ENABLED: 'true',
        FLOW_PLAYWRIGHT_MODE: 'auto',
        FLOW_PLAYWRIGHT_STORAGE_STATE_PATH: '/tmp/state.json',
        FLOW_PLAYWRIGHT_TIMEOUT_MS: '30000',
        FLOW_PLAYWRIGHT_MANUAL_WAIT_MS: '120000',
        FLOW_PLAYWRIGHT_RECOVERY_URL: 'https://labs.google/fx',
        FLOW_PLAYWRIGHT_PROFILE_KEY: 'default',
        CI: 'true',
      }).effectiveMode,
    ).toBe('headless');

    expect(
      parseRecoveryConfig({
        FLOW_PLAYWRIGHT_ENABLED: 'true',
        FLOW_PLAYWRIGHT_MODE: 'auto',
        FLOW_PLAYWRIGHT_STORAGE_STATE_PATH: '/tmp/state.json',
        FLOW_PLAYWRIGHT_TIMEOUT_MS: '30000',
        FLOW_PLAYWRIGHT_MANUAL_WAIT_MS: '120000',
        FLOW_PLAYWRIGHT_RECOVERY_URL: 'https://labs.google/fx',
        FLOW_PLAYWRIGHT_PROFILE_KEY: 'default',
        CI: '1',
      }).effectiveMode,
    ).toBe('headless');
  });

  it('rejects invalid numeric timeout values', () => {
    expect(() =>
      parseRecoveryConfig({
        FLOW_PLAYWRIGHT_ENABLED: 'true',
        FLOW_PLAYWRIGHT_MODE: 'headed',
        FLOW_PLAYWRIGHT_STORAGE_STATE_PATH: '/tmp/state.json',
        FLOW_PLAYWRIGHT_TIMEOUT_MS: 'oops',
        FLOW_PLAYWRIGHT_MANUAL_WAIT_MS: '120000',
        FLOW_PLAYWRIGHT_RECOVERY_URL: 'https://labs.google/fx',
        FLOW_PLAYWRIGHT_PROFILE_KEY: 'default',
      }),
    ).toThrow(/timeout/i);
  });
});
