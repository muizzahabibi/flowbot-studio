import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlowError, type FlowBatchGenerateResponse } from '@flowbot-studio/core';
import { FlowRecoveryOrchestrator } from '../src/services/flow-recovery-orchestrator.js';
import type { RecoveryResult } from '../src/services/recovery-types.js';

function createResponse(): FlowBatchGenerateResponse {
  return {
    name: 'batches/test',
    generatedImages: [],
  } as unknown as FlowBatchGenerateResponse;
}

function createRecoverableError(code: string, message = code): FlowError {
  return new FlowError(message, {
    code,
    statusCode: 401,
    retryable: true,
  });
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

describe('FlowRecoveryOrchestrator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries one generate request after FLOW_AUTH_REFRESH_NEEDED recovery', async () => {
    const response = createResponse();
    const generate = vi
      .fn<(retryInput?: { cookieHeader?: string; recaptchaToken?: string }) => Promise<FlowBatchGenerateResponse>>()
      .mockRejectedValueOnce(createRecoverableError('FLOW_AUTH_REFRESH_NEEDED'))
      .mockResolvedValueOnce(response);
    const recover = vi.fn<() => Promise<RecoveryResult>>().mockResolvedValue({
      recoveredCookieHeader: 'SID=fresh; HSID=fresh',
      storageStateUpdated: true,
      manualActionRequired: false,
      recoveryAttempted: true,
    });

    const orchestrator = new FlowRecoveryOrchestrator({
      profileKey: 'profile-a',
      recover,
    });

    const result = await orchestrator.runGenerateWithRecovery({
      recaptchaToken: 'caller-token',
      generate,
      retryGenerate: generate,
    });

    expect(result).toBe(response);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenNthCalledWith(1);
    expect(generate).toHaveBeenNthCalledWith(2, {
      cookieHeader: 'SID=fresh; HSID=fresh',
      recaptchaToken: 'caller-token',
    });
  });

  it('reuses one in-flight recovery per profile key', async () => {
    const response = createResponse();
    const releaseRecovery = createDeferred<RecoveryResult>();
    const recover = vi.fn<() => Promise<RecoveryResult>>().mockReturnValue(releaseRecovery.promise);
    const generateA = vi
      .fn<(retryInput?: { cookieHeader?: string; recaptchaToken?: string }) => Promise<FlowBatchGenerateResponse>>()
      .mockRejectedValueOnce(createRecoverableError('FLOW_AUTH_REFRESH_NEEDED'))
      .mockResolvedValueOnce(response);
    const generateB = vi
      .fn<(retryInput?: { cookieHeader?: string; recaptchaToken?: string }) => Promise<FlowBatchGenerateResponse>>()
      .mockRejectedValueOnce(createRecoverableError('FLOW_AUTH_REFRESH_NEEDED'))
      .mockResolvedValueOnce(response);

    const orchestrator = new FlowRecoveryOrchestrator({
      profileKey: 'shared-profile',
      recover,
    });

    const first = orchestrator.runGenerateWithRecovery({
      recaptchaToken: 'token-a',
      generate: generateA,
      retryGenerate: generateA,
    });
    const second = orchestrator.runGenerateWithRecovery({
      recaptchaToken: 'token-b',
      generate: generateB,
      retryGenerate: generateB,
    });

    await Promise.resolve();
    expect(recover).toHaveBeenCalledTimes(1);

    releaseRecovery.resolve({
      recoveredCookieHeader: 'SID=fresh; HSID=fresh',
      storageStateUpdated: true,
      manualActionRequired: false,
      recoveryAttempted: true,
    });

    await expect(Promise.all([first, second])).resolves.toEqual([response, response]);
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it('fails instead of retrying with a stale recaptcha token when recovery has no fresh retry input', async () => {
    const generate = vi
      .fn<(retryInput?: { cookieHeader?: string; recaptchaToken?: string }) => Promise<FlowBatchGenerateResponse>>()
      .mockRejectedValueOnce(createRecoverableError('FLOW_CAPTCHA_RELOAD_REQUIRED'));
    const recover = vi.fn<() => Promise<RecoveryResult>>().mockResolvedValue({
      recoveredCookieHeader: 'SID=fresh; HSID=fresh',
      storageStateUpdated: true,
      manualActionRequired: false,
      recoveryAttempted: true,
    });

    const orchestrator = new FlowRecoveryOrchestrator({
      profileKey: 'profile-captcha',
      recover,
    });

    await expect(
      orchestrator.runGenerateWithRecovery({
        recaptchaToken: 'stale-token',
        generate,
        retryGenerate: generate,
      }),
    ).rejects.toMatchObject({
      code: 'FLOW_PLAYWRIGHT_RECOVERY_FAILED',
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it('starts recovery from FLOW_CAPTCHA_RELOAD_REQUIRED classification path', async () => {
    const response = createResponse();
    const generate = vi
      .fn<(retryInput?: { cookieHeader?: string; recaptchaToken?: string }) => Promise<FlowBatchGenerateResponse>>()
      .mockRejectedValueOnce(
        new FlowError('reCAPTCHA token invalid or expired', {
          statusCode: 400,
          details: { error: { message: 'reCAPTCHA token invalid or expired' } },
          endpoint: 'batch-generate-images',
        }),
      )
      .mockResolvedValueOnce(response);
    const recover = vi.fn<() => Promise<RecoveryResult>>().mockResolvedValue({
      recoveredCookieHeader: 'SID=fresh; HSID=fresh',
      replacementRecaptchaToken: 'fresh-token',
      storageStateUpdated: true,
      manualActionRequired: false,
      recoveryAttempted: true,
    });

    const orchestrator = new FlowRecoveryOrchestrator({
      profileKey: 'profile-recaptcha',
      recover,
    });

    const result = await orchestrator.runGenerateWithRecovery({
      recaptchaToken: 'stale-token',
      generate,
      retryGenerate: generate,
    });

    expect(result).toBe(response);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenNthCalledWith(2, {
      cookieHeader: 'SID=fresh; HSID=fresh',
      recaptchaToken: 'fresh-token',
    });
  });

  it('rethrows FLOW_MANUAL_BROWSER_ACTION_REQUIRED instead of collapsing it into generic recovery failure', async () => {
    const generate = vi
      .fn<(retryInput?: { cookieHeader?: string; recaptchaToken?: string }) => Promise<FlowBatchGenerateResponse>>()
      .mockRejectedValueOnce(createRecoverableError('FLOW_AUTH_REFRESH_NEEDED'));
    const recover = vi.fn<() => Promise<RecoveryResult>>().mockResolvedValue({
      storageStateUpdated: false,
      manualActionRequired: true,
      recoveryAttempted: true,
      code: 'FLOW_MANUAL_BROWSER_ACTION_REQUIRED',
    });

    const orchestrator = new FlowRecoveryOrchestrator({
      profileKey: 'profile-manual',
      recover,
    });

    await expect(
      orchestrator.runGenerateWithRecovery({
        generate,
        retryGenerate: generate,
      }),
    ).rejects.toMatchObject({
      code: 'FLOW_MANUAL_BROWSER_ACTION_REQUIRED',
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it('rethrows the original recoverable error when recovery is disabled and not attempted', async () => {
    const error = createRecoverableError('FLOW_AUTH_REFRESH_NEEDED');
    const generate = vi
      .fn<(retryInput?: { cookieHeader?: string; recaptchaToken?: string }) => Promise<FlowBatchGenerateResponse>>()
      .mockRejectedValueOnce(error);
    const recover = vi.fn<() => Promise<RecoveryResult>>().mockResolvedValue({
      storageStateUpdated: false,
      manualActionRequired: false,
      recoveryAttempted: false,
      code: 'FLOW_PLAYWRIGHT_RECOVERY_FAILED',
    });

    const orchestrator = new FlowRecoveryOrchestrator({
      profileKey: 'profile-disabled',
      recover,
    });

    await expect(
      orchestrator.runGenerateWithRecovery({
        generate,
        retryGenerate: generate,
      }),
    ).rejects.toBe(error);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(recover).toHaveBeenCalledTimes(1);
  });
});
