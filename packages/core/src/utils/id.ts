export function createSessionId(): string {
  return `;${Date.now()}`;
}

export function createUuidFallback(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(16)}-${random}`;
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return createUuidFallback();
}
