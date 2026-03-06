import type { FlowClientConfig, TelemetryMode } from '@flowbot-studio/core';

export type ParsedOptions = Record<string, string | boolean | string[]>;

export interface ParsedArgs {
  positionals: string[];
  options: ParsedOptions;
}

function setOption(options: ParsedOptions, key: string, value: string | boolean): void {
  if (!(key in options)) {
    options[key] = value;
    return;
  }

  const current = options[key];
  if (Array.isArray(current)) {
    current.push(String(value));
    options[key] = current;
    return;
  }

  options[key] = [String(current), String(value)];
}

export function parseCliArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options: ParsedOptions = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;

    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const pair = arg.slice(2);
    const eqIndex = pair.indexOf('=');
    if (eqIndex >= 0) {
      const key = pair.slice(0, eqIndex);
      const value = pair.slice(eqIndex + 1);
      setOption(options, key, value);
      continue;
    }

    const key = pair;
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      setOption(options, key, next);
      i += 1;
    } else {
      setOption(options, key, true);
    }
  }

  return { positionals, options };
}

export function getStringOption(options: ParsedOptions, key: string): string | undefined {
  const value = options[key];
  if (Array.isArray(value)) return value[value.length - 1];
  if (typeof value === 'string') return value;
  return undefined;
}

export function getNumberOption(options: ParsedOptions, key: string): number | undefined {
  const value = getStringOption(options, key);
  if (!value) return undefined;
  const n = Number(value);
  if (Number.isNaN(n)) return undefined;
  return n;
}

export function getBooleanOption(options: ParsedOptions, key: string): boolean {
  const value = options[key];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }
  if (Array.isArray(value)) {
    const last = value[value.length - 1];
    if (!last) return false;
    const nested: ParsedOptions = { [key]: last };
    return getBooleanOption(nested, key);
  }
  return false;
}

export function getStringArrayOption(options: ParsedOptions, key: string): string[] {
  const value = options[key];
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => entry.split(',')).map((entry) => entry.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

export function requireStringOption(options: ParsedOptions, key: string): string {
  const value = getStringOption(options, key);
  if (!value?.trim()) {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

export function buildClientConfig(options: ParsedOptions): FlowClientConfig {
  const retries = getNumberOption(options, 'retries');
  const timeoutMs = getNumberOption(options, 'timeout-ms');
  const telemetryRaw = getStringOption(options, 'telemetry');

  let telemetryMode: TelemetryMode | undefined;
  if (telemetryRaw === 'enabled' || telemetryRaw === 'disabled') {
    telemetryMode = telemetryRaw;
  }

  const result: FlowClientConfig = {};

  const cookie = getStringOption(options, 'cookie');
  const bearerToken = getStringOption(options, 'bearer-token');
  const googleApiKey = getStringOption(options, 'google-api-key');
  const apiBaseUrl = getStringOption(options, 'api-base-url');
  const trpcBaseUrl = getStringOption(options, 'trpc-base-url');

  if (cookie !== undefined) result.cookie = cookie;
  if (bearerToken !== undefined) result.bearerToken = bearerToken;
  if (googleApiKey !== undefined) result.googleApiKey = googleApiKey;
  if (apiBaseUrl !== undefined) result.apiBaseUrl = apiBaseUrl;
  if (trpcBaseUrl !== undefined) result.trpcBaseUrl = trpcBaseUrl;
  if (retries !== undefined) result.retries = retries;
  if (telemetryMode !== undefined) result.telemetryMode = telemetryMode;

  if (timeoutMs !== undefined) {
    result.timeoutMs = {
      default: timeoutMs,
      upload: timeoutMs,
      generate: timeoutMs,
      fetch: timeoutMs,
    };
  }

  return result;
}
