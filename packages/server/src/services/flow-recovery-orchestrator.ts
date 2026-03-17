import { FlowError, type FlowBatchGenerateResponse, type FlowErrorOptions } from '@flowbot-studio/core';
import type { RecoveryResult } from './recovery-types.js';

const RECOVERABLE_CODES = new Set([
  'FLOW_AUTH_REFRESH_NEEDED',
  'FLOW_AUTH_INVALID_COOKIE',
  'FLOW_CAPTCHA_RELOAD_REQUIRED',
]);

export interface FlowGenerateRetryInput {
  cookieHeader?: string;
  recaptchaToken?: string;
}

export interface FlowRecoveryRunInput {
  recaptchaToken?: string;
  generate: (retryInput?: FlowGenerateRetryInput) => Promise<FlowBatchGenerateResponse>;
  retryGenerate?: (retryInput: FlowGenerateRetryInput) => Promise<FlowBatchGenerateResponse>;
}

export interface FlowRecoveryOrchestratorDeps {
  profileKey: string;
  recover: () => Promise<RecoveryResult>;
}

const recoveryFlights = new Map<string, Promise<RecoveryResult>>();

export class FlowRecoveryOrchestrator {
  constructor(private readonly deps: FlowRecoveryOrchestratorDeps) {}

  shouldRecover(error: unknown): boolean {
    return isRecoverableGenerateError(classifyGenerateError(error));
  }

  async runGenerateWithRecovery(input: FlowRecoveryRunInput): Promise<FlowBatchGenerateResponse> {
    try {
      return await input.generate();
    } catch (error) {
      const classified = classifyGenerateError(error);
      if (!isRecoverableGenerateError(classified)) {
        throw classified;
      }

      const recovery = await this.runSingleFlightRecovery();
      if (!recovery.recoveryAttempted) {
        throw classified;
      }

      const retryInput = this.buildRetryInput(classified, input.recaptchaToken, recovery);
      const retryGenerate = input.retryGenerate ?? input.generate;
      return await retryGenerate(retryInput);
    }
  }

  private async runSingleFlightRecovery(): Promise<RecoveryResult> {
    const existing = recoveryFlights.get(this.deps.profileKey);
    if (existing) {
      return await existing;
    }

    const inFlight = this.deps.recover().finally(() => {
      if (recoveryFlights.get(this.deps.profileKey) === inFlight) {
        recoveryFlights.delete(this.deps.profileKey);
      }
    });

    recoveryFlights.set(this.deps.profileKey, inFlight);
    return await inFlight;
  }

  private buildRetryInput(
    error: FlowError,
    originalRecaptchaToken: string | undefined,
    recovery: RecoveryResult,
  ): FlowGenerateRetryInput {
    if (recovery.code) {
      throw createRecoveryCodeError(recovery.code);
    }

    if (!recovery.recoveredCookieHeader) {
      throw createRecoveryFailedError('Recovery did not return a fresh cookie header');
    }

    if (error.code === 'FLOW_CAPTCHA_RELOAD_REQUIRED') {
      if (!recovery.replacementRecaptchaToken?.trim()) {
        throw createRecoveryFailedError('Recovery did not return a replacement recaptcha token');
      }

      return {
        cookieHeader: recovery.recoveredCookieHeader,
        recaptchaToken: recovery.replacementRecaptchaToken,
      };
    }

    if (originalRecaptchaToken?.trim()) {
      return {
        cookieHeader: recovery.recoveredCookieHeader,
        recaptchaToken: originalRecaptchaToken,
      };
    }

    return {
      cookieHeader: recovery.recoveredCookieHeader,
    };
  }
}

function classifyGenerateError(error: unknown): unknown {
  if (!(error instanceof FlowError)) {
    return error;
  }

  if (hasRecoverableGenerateCode(error)) {
    return error;
  }

  if (isCaptchaReloadError(error)) {
    const options: FlowErrorOptions = {
      code: 'FLOW_CAPTCHA_RELOAD_REQUIRED',
      retryable: true,
    };

    if (error.statusCode !== undefined) {
      options.statusCode = error.statusCode;
    }
    if (error.details !== undefined) {
      options.details = error.details;
    }
    if (error.endpoint !== undefined) {
      options.endpoint = error.endpoint;
    }

    return new FlowError(error.message, options);
  }

  return error;
}

function isRecoverableGenerateError(error: unknown): error is FlowError {
  return error instanceof FlowError && hasRecoverableGenerateCode(error);
}

function hasRecoverableGenerateCode(error: FlowError): boolean {
  return error.code !== undefined && RECOVERABLE_CODES.has(error.code);
}

function isCaptchaReloadError(error: FlowError): boolean {
  if (error.statusCode !== 400) {
    return false;
  }

  const haystack = [error.message, stringifyDetails(error.details)].filter(Boolean).join(' ').toLowerCase();
  const mentionsCaptcha = haystack.includes('recaptcha') || haystack.includes('captcha');
  const mentionsReload = haystack.includes('invalid') || haystack.includes('expired') || haystack.includes('reload');

  return mentionsCaptcha && mentionsReload;
}

function stringifyDetails(details: unknown): string {
  if (typeof details === 'string') {
    return details;
  }

  try {
    return JSON.stringify(details);
  } catch {
    return '';
  }
}

function createRecoveryCodeError(code: RecoveryResult['code']): FlowError {
  const details = {
    recoveryAttempted: true,
    manualActionRequired: code === 'FLOW_MANUAL_BROWSER_ACTION_REQUIRED',
  };

  if (code === 'FLOW_MANUAL_BROWSER_ACTION_REQUIRED') {
    return new FlowError('Manual browser action required to complete recovery', {
      code,
      statusCode: 503,
      retryable: false,
      source: 'recovery',
      details,
    });
  }

  return new FlowError('Playwright recovery failed', {
    code: 'FLOW_PLAYWRIGHT_RECOVERY_FAILED',
    statusCode: 503,
    retryable: false,
    source: 'recovery',
    details,
  });
}

function createRecoveryFailedError(message: string): FlowError {
  return new FlowError(message, {
    code: 'FLOW_PLAYWRIGHT_RECOVERY_FAILED',
    statusCode: 503,
    retryable: false,
    source: 'recovery',
  });
}
