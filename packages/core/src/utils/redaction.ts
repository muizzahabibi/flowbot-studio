const SECRET_HEADERS = new Set(['authorization', 'cookie', 'set-cookie']);

const SIGNED_URL_QUERY_KEYS = ['Signature', 'GoogleAccessId', 'Expires', 'X-Goog-Signature'];

function redactSignedUrl(value: string): string {
  try {
    const u = new URL(value);
    for (const key of SIGNED_URL_QUERY_KEYS) {
      if (u.searchParams.has(key)) {
        u.searchParams.set(key, '[REDACTED]');
      }
    }
    return u.toString();
  } catch {
    return value;
  }
}

export function redactValue(input: unknown): unknown {
  if (typeof input === 'string') {
    const looksLikeBearer = input.toLowerCase().includes('bearer ');
    const looksLikeSession = input.toLowerCase().includes('next-auth.session-token');
    if (looksLikeBearer || looksLikeSession) return '[REDACTED]';
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return redactSignedUrl(input);
    }
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactValue(item));
  }

  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (SECRET_HEADERS.has(key.toLowerCase())) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactValue(value);
      }
    }
    return out;
  }

  return input;
}
