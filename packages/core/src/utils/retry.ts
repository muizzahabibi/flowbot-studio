import { FlowRetryExhaustedError } from './errors.js';

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 300,
  maxDelayMs: 5_000,
};

function computeDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 120);
  return Math.min(maxDelayMs, exp + jitter);
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  shouldRetry: (error: unknown) => boolean,
  endpoint: string,
): Promise<T> {
  for (let attempt = 0; attempt <= policy.maxRetries; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!shouldRetry(error)) {
        throw error;
      }

      if (attempt >= policy.maxRetries) {
        throw new FlowRetryExhaustedError('Retry attempts exhausted', error, endpoint);
      }

      const delay = computeDelay(attempt, policy.baseDelayMs, policy.maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new FlowRetryExhaustedError('Retry attempts exhausted', undefined, endpoint);
}
