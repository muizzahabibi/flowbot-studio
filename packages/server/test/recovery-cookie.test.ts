import { describe, expect, it } from 'vitest';
import { FlowAuthError } from '@flowbot-studio/core';
import { parseBootstrapCookie, serializeRecoveredCookieHeader } from '../src/services/recovery-cookie.js';

describe('recovery-cookie', () => {
  it("parses 'SID=abc; HSID=def'", () => {
    const cookies = parseBootstrapCookie('SID=abc; HSID=def', {
      domain: '.google.com',
      profileKey: 'default',
    });

    expect(cookies).toEqual([
      expect.objectContaining({ name: 'SID', value: 'abc', domain: '.google.com', path: '/', secure: true }),
      expect.objectContaining({ name: 'HSID', value: 'def', domain: '.google.com', path: '/', secure: true }),
    ]);
  });

  it('accepts cookie values containing equals signs', () => {
    const cookies = parseBootstrapCookie('SID=abc==; HSID=def=', {
      domain: '.google.com',
      profileKey: 'default',
    });

    expect(cookies).toEqual([
      expect.objectContaining({ name: 'SID', value: 'abc==', domain: '.google.com' }),
      expect.objectContaining({ name: 'HSID', value: 'def=', domain: '.google.com' }),
    ]);
  });

  it('rejects malformed segments with FLOW_AUTH_INVALID_COOKIE and without leaking raw cookie values', () => {
    const rawCookies = ['SID=super-secret; broken', 'SID=super-secret;;HSID=def', ';SID=super-secret'];

    for (const rawCookie of rawCookies) {
      let thrown: unknown;
      try {
        parseBootstrapCookie(rawCookie, { domain: '.google.com', profileKey: 'default' });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(FlowAuthError);
      expect(thrown).toMatchObject({ code: 'FLOW_AUTH_INVALID_COOKIE' });
      expect(String((thrown as Error).message)).not.toContain('super-secret');
      expect(JSON.stringify(thrown)).not.toContain('super-secret');
    }
  });

  it('rejects ambiguous multi-account cookie strings', () => {
    let thrown: unknown;
    try {
      parseBootstrapCookie('ACCOUNT_CHOOSER=one,two; SID=abc', {
        domain: '.google.com',
        profileKey: 'default',
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(FlowAuthError);
    expect(thrown).toMatchObject({ code: 'FLOW_AUTH_INVALID_COOKIE' });
  });

  it("serializer returns 'SID=abc; HSID=def'", () => {
    const header = serializeRecoveredCookieHeader([
      { name: 'SID', value: 'abc', domain: '.google.com' },
      { name: 'HSID', value: 'def', domain: '.google.com' },
    ]);

    expect(header).toBe('SID=abc; HSID=def');
  });
});
