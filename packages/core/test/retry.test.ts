import { describe, expect, it, vi } from 'vitest';
import { withRetry } from '../src/utils/retry.js';
import { FlowRetryExhaustedError } from '../src/utils/errors.js';

describe('withRetry', () => {
  it('retries and eventually succeeds', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) throw new Error('temporary');
        return 'ok';
      },
      { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0 },
      () => true,
      'test-endpoint',
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(2);
    randomSpy.mockRestore();
  });

  it('throws retry exhausted when all retries fail', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    await expect(
      withRetry(
        async () => {
          throw new Error('still failing');
        },
        { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 },
        () => true,
        'test-endpoint',
      ),
    ).rejects.toBeInstanceOf(FlowRetryExhaustedError);

    randomSpy.mockRestore();
  });
});
