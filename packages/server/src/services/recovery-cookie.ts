import { FlowAuthError } from '@flowbot-studio/core';
import type { BrowserContextCookie, ParseCookieInput, RecoveredCookie } from './recovery-types.js';

const RETRY_COOKIE_NAMES = new Set(['SID', 'HSID']);
const ALLOWED_DOMAINS = new Set(['.google.com', 'google.com', '.labs.google', 'labs.google', '.flow.google.com', 'flow.google.com']);
const AMBIGUOUS_MULTI_ACCOUNT_COOKIES = new Set(['ACCOUNT_CHOOSER']);

export function parseBootstrapCookie(rawCookie: string, input: ParseCookieInput): BrowserContextCookie[] {
  const normalizedDomain = normalizeDomain(input.domain);
  const profileKey = normalizeProfileKey(input.profileKey);
  const segments = rawCookie.split(';').map((segment) => segment.trim());

  if (segments.some((segment) => segment.length === 0)) {
    throw invalidCookie('Malformed cookie segment in bootstrap cookie header');
  }

  const parsed = segments.map((segment) => parseSegment(segment));
  ensureUnambiguousAccount(parsed, profileKey);

  return parsed.map(({ name, value }) => ({
    name,
    value,
    domain: normalizedDomain,
    path: '/',
    secure: true,
    httpOnly: false,
  }));
}

export function serializeRecoveredCookieHeader(cookies: RecoveredCookie[]): string {
  return cookies
    .filter((cookie) => RETRY_COOKIE_NAMES.has(cookie.name))
    .map((cookie) => {
      validateCookieName(cookie.name);
      validateCookieValue(cookie.value, cookie.name);
      return `${cookie.name}=${cookie.value}`;
    })
    .join('; ');
}

function parseSegment(segment: string): { name: string; value: string } {
  const separatorIndex = segment.indexOf('=');
  if (separatorIndex <= 0) {
    throw invalidCookie('Malformed cookie segment in bootstrap cookie header');
  }

  const name = segment.slice(0, separatorIndex).trim();
  const value = segment.slice(separatorIndex + 1).trim();

  validateCookieName(name);
  validateCookieValue(value, name);

  return { name, value };
}

function ensureUnambiguousAccount(cookies: Array<{ name: string; value: string }>, profileKey: string): void {
  const chooser = cookies.find((cookie) => AMBIGUOUS_MULTI_ACCOUNT_COOKIES.has(cookie.name));
  if (!chooser) return;

  const accounts = chooser.value
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (accounts.length <= 1) return;
  if (accounts.includes(profileKey)) return;

  throw invalidCookie('Bootstrap cookie header contains ambiguous multi-account state for the configured profile');
}

function normalizeDomain(domain: string): string {
  const trimmed = domain.trim();
  if (!trimmed) {
    throw invalidCookie('Bootstrap cookie domain must be configured');
  }
  if (!ALLOWED_DOMAINS.has(trimmed)) {
    throw invalidCookie('Bootstrap cookie domain is not allowed for Playwright recovery');
  }
  return trimmed;
}

function normalizeProfileKey(profileKey: string): string {
  const trimmed = profileKey.trim();
  if (!trimmed) {
    throw invalidCookie('Recovery profile key must be configured');
  }
  return trimmed;
}

function validateCookieName(name: string): void {
  if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(name)) {
    throw invalidCookie('Bootstrap cookie header contains an invalid cookie name');
  }
}

function validateCookieValue(value: string, name: string): void {
  if (value.length === 0) {
    throw invalidCookie(`Bootstrap cookie header is missing a value for cookie ${name}`);
  }
  if (/[;\r\n]/.test(value)) {
    throw invalidCookie(`Bootstrap cookie header contains an invalid value for cookie ${name}`);
  }
}

function invalidCookie(message: string): FlowAuthError {
  return new FlowAuthError(message, { code: 'FLOW_AUTH_INVALID_COOKIE' });
}
