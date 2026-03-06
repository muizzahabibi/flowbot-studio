import { describe, expect, it } from 'vitest';
import { redactValue } from '../src/utils/redaction.js';

describe('redactValue', () => {
  it('redacts auth headers and cookies', () => {
    const result = redactValue({
      authorization: 'Bearer secret-token',
      cookie: '__Secure-next-auth.session-token=abc',
      nested: { ok: true },
    }) as Record<string, unknown>;

    expect(result.authorization).toBe('[REDACTED]');
    expect(result.cookie).toBe('[REDACTED]');
    expect(result.nested).toEqual({ ok: true });
  });

  it('redacts signed URL query params', () => {
    const url =
      'https://example.com/file.png?Signature=abc&GoogleAccessId=id&Expires=123&safe=1';
    const out = redactValue(url) as string;

    expect(out).toContain('Signature=%5BREDACTED%5D');
    expect(out).toContain('GoogleAccessId=%5BREDACTED%5D');
    expect(out).toContain('Expires=%5BREDACTED%5D');
    expect(out).toContain('safe=1');
  });
});
