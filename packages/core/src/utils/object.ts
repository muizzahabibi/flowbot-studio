export function setIfDefined<T extends Record<string, unknown>, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

export function compactObject<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) {
      out[k as keyof T] = v as T[keyof T];
    }
  }
  return out;
}
