import { describe, expect, it } from 'vitest';
import { FlowAuthError, FlowError, FlowRetryExhaustedError, FlowValidationError } from '../src/utils/errors.js';

describe('FlowError constructors', () => {
  it('supports object-style options with code, source, and retryable metadata', () => {
    const error = new FlowError('boom', {
      code: 'FLOW_AUTH_REFRESH_NEEDED',
      statusCode: 401,
      details: { reason: 'expired' },
      endpoint: 'auth/session',
      source: 'auth_session',
      retryable: true,
    });

    expect(error).toMatchObject({
      name: 'FlowError',
      message: 'boom',
      code: 'FLOW_AUTH_REFRESH_NEEDED',
      statusCode: 401,
      details: { reason: 'expired' },
      endpoint: 'auth/session',
      source: 'auth_session',
      retryable: true,
    });
  });

  it('preserves the legacy positional constructor overload', () => {
    const error = new FlowError('legacy', 503, { reason: 'retry' }, 'test-endpoint');

    expect(error).toMatchObject({
      name: 'FlowError',
      message: 'legacy',
      statusCode: 503,
      details: { reason: 'retry' },
      endpoint: 'test-endpoint',
    });
    expect(error.code).toBeUndefined();
    expect(error.source).toBeUndefined();
    expect(error.retryable).toBeUndefined();
  });

  it('keeps derived error defaults with object-style options', () => {
    const authError = new FlowAuthError('auth failed', {
      code: 'FLOW_AUTH_INVALID_COOKIE',
      retryable: true,
      details: { reason: 'missing' },
    });
    const validationError = new FlowValidationError('bad input', { field: 'prompt' });
    const retryError = new FlowRetryExhaustedError('retry exhausted', { attempt: 3 }, 'flow/generate');

    expect(authError).toMatchObject({
      name: 'FlowAuthError',
      statusCode: 401,
      endpoint: 'auth/session',
      source: 'auth_session',
      code: 'FLOW_AUTH_INVALID_COOKIE',
      retryable: true,
      details: { reason: 'missing' },
    });
    expect(validationError).toMatchObject({
      name: 'FlowValidationError',
      statusCode: 400,
      details: { field: 'prompt' },
    });
    expect(retryError).toMatchObject({
      name: 'FlowRetryExhaustedError',
      statusCode: 503,
      details: { attempt: 3 },
      endpoint: 'flow/generate',
    });
  });
});
