import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { parseBootstrapCookie, serializeRecoveredCookieHeader } from './recovery-cookie.js';
import { type PlaywrightStorageState, RecoveryStateStore } from './recovery-state-store.js';
import type { BrowserContextCookie, RecoveryConfig, RecoveryInput, RecoveryResult } from './recovery-types.js';

type RecoveryCookie = Pick<BrowserContextCookie, 'name' | 'value' | 'domain'>;

const REQUIRED_COOKIE_NAMES = new Set(['SID', 'HSID']);

interface RecoveryStateStoreLike {
  load(): Promise<PlaywrightStorageState | undefined>;
  save(state: PlaywrightStorageState): Promise<void>;
  quarantine(reason: string): Promise<void>;
}

interface PlaywrightLike {
  chromium: {
    launch(options: { headless: boolean }): Promise<Browser>;
  };
}

interface PlaywrightRecoveryServiceDeps {
  config: RecoveryConfig;
  stateStore?: RecoveryStateStoreLike;
  playwright?: PlaywrightLike;
}

export class PlaywrightRecoveryService {
  private readonly stateStore: RecoveryStateStoreLike;
  private readonly playwright: PlaywrightLike;

  constructor(private readonly deps: PlaywrightRecoveryServiceDeps) {
    this.stateStore = deps.stateStore ?? new RecoveryStateStore({
      storageStatePath: deps.config.storageStatePath,
      profileKey: deps.config.profileKey,
    });
    this.playwright = deps.playwright ?? { chromium };
  }

  async recover(input: RecoveryInput): Promise<RecoveryResult> {
    if (!this.deps.config.enabled) {
      return recoveryNotAttemptedResult();
    }

    const browser = await this.playwright.chromium.launch({
      headless: this.deps.config.effectiveMode === 'headless',
    });

    try {
      return await this.recoverWithBrowser(browser, input);
    } finally {
      await browser.close();
    }
  }

  private async recoverWithBrowser(browser: Browser, input: RecoveryInput): Promise<RecoveryResult> {
    const bootstrapCookies = this.getBootstrapCookies(input);
    const savedState = await this.stateStore.load();

    if (!savedState) {
      return await this.tryRecoverWithBootstrapCookie(browser, input, bootstrapCookies);
    }

    const savedAttempt = await this.tryRecoverWithSavedState(browser, savedState, input);
    if (!savedAttempt) {
      return await this.tryRecoverWithBootstrapCookie(browser, input, bootstrapCookies);
    }

    if (savedAttempt.recoveredCookieHeader) {
      return savedAttempt;
    }

    if (bootstrapCookies.length === 0) {
      return savedAttempt;
    }

    await this.stateStore.quarantine('Saved Playwright storage state did not yield a valid recovered cookie header');
    return await this.tryRecoverWithBootstrapCookie(browser, input, bootstrapCookies);
  }

  private async tryRecoverWithSavedState(
    browser: Browser,
    savedState: PlaywrightStorageState,
    input: RecoveryInput,
  ): Promise<RecoveryResult | undefined> {
    let context: BrowserContext | undefined;

    try {
      context = await browser.newContext({ storageState: savedState });
    } catch {
      await this.stateStore.quarantine('Saved Playwright storage state was rejected by browser context creation');
      return undefined;
    }

    try {
      return await this.runRecoveryFlow(context, input);
    } finally {
      await context.close();
    }
  }

  private async tryRecoverWithBootstrapCookie(
    browser: Browser,
    input: RecoveryInput,
    bootstrapCookies: RecoveryCookie[],
  ): Promise<RecoveryResult> {
    const context = await browser.newContext();

    try {
      if (bootstrapCookies.length > 0) {
        await context.addCookies(bootstrapCookies);
      }

      return await this.runRecoveryFlow(context, input, bootstrapCookies);
    } finally {
      await context.close();
    }
  }

  private getBootstrapCookies(input: RecoveryInput): RecoveryCookie[] {
    return this.deps.config.bootstrapCookie
      ? parseBootstrapCookie(this.deps.config.bootstrapCookie, {
          domain: input.cookieDomain,
          profileKey: this.deps.config.profileKey,
        })
      : [];
  }

  private async runRecoveryFlow(
    context: BrowserContext,
    input: RecoveryInput,
    bootstrapCookies: RecoveryCookie[] = [],
  ): Promise<RecoveryResult> {
    const page = await context.newPage();
    await this.openRecoveryPage(page);

    if (await this.checkRecoverySuccess(context, input, bootstrapCookies)) {
      return await this.finalizeRecovery(context, input.cookieDomain, bootstrapCookies);
    }

    if (this.deps.config.effectiveMode === 'headless') {
      return manualActionRequiredResult();
    }

    await page.waitForTimeout(this.deps.config.manualWaitMs);

    if (!(await this.checkRecoverySuccess(context, input, bootstrapCookies))) {
      return recoveryFailedResult();
    }

    return await this.finalizeRecovery(context, input.cookieDomain, bootstrapCookies);
  }

  private async openRecoveryPage(page: Page): Promise<void> {
    await page.goto(this.deps.config.recoveryUrl, {
      waitUntil: 'domcontentloaded',
      timeout: this.deps.config.timeoutMs,
    });
  }

  private async checkRecoverySuccess(
    context: BrowserContext,
    input: RecoveryInput,
    bootstrapCookies: RecoveryCookie[],
  ): Promise<boolean> {
    const recoveredCookieHeader = this.extractRecoveredCookieHeader(
      await context.cookies(),
      input.cookieDomain,
      bootstrapCookies,
    );

    return await input.success(
      recoveredCookieHeader === undefined ? {} : { recoveredCookieHeader },
    );
  }

  private async finalizeRecovery(
    context: BrowserContext,
    cookieDomain: string,
    bootstrapCookies: RecoveryCookie[] = [],
  ): Promise<RecoveryResult> {
    const cookies = await context.cookies();
    const recoveredCookieHeader = this.extractRecoveredCookieHeader(cookies, cookieDomain, bootstrapCookies);
    if (!recoveredCookieHeader) {
      return recoveryFailedResult();
    }

    await this.stateStore.save(await context.storageState());

    return {
      recoveredCookieHeader,
      storageStateUpdated: true,
      manualActionRequired: false,
      recoveryAttempted: true,
    };
  }

  private extractRecoveredCookieHeader(
    cookies: RecoveryCookie[],
    cookieDomain: string,
    bootstrapCookies: RecoveryCookie[] = [],
  ): string | undefined {
    const allowedDomains = new Set(normalizeCookieDomains(cookieDomain));
    const relevantCookies = cookies.filter((cookie) => {
      const isRequiredCookie = REQUIRED_COOKIE_NAMES.has(cookie.name);
      return isRequiredCookie && allowedDomains.has(normalizeDomain(cookie.domain));
    });

    const sidCandidates = relevantCookies.filter((cookie) => cookie.name === 'SID');
    const hsidCandidates = relevantCookies.filter((cookie) => cookie.name === 'HSID');
    if (sidCandidates.length === 0 || hsidCandidates.length === 0) {
      return undefined;
    }

    const sid = selectRecoveredCookie(sidCandidates, bootstrapCookies);
    const hsid = selectRecoveredCookie(hsidCandidates, bootstrapCookies);
    if (matchesBootstrapPair([sid, hsid], bootstrapCookies)) {
      return undefined;
    }

    const header = serializeRecoveredCookieHeader([sid, hsid]);
    return header ? header : undefined;
  }
}

function selectRecoveredCookie(
  candidates: RecoveryCookie[],
  bootstrapCookies: RecoveryCookie[],
): { name: string; value: string; domain: string } {
  const fallback = candidates[0];
  if (!fallback) {
    throw new Error('selectRecoveredCookie requires at least one candidate');
  }

  const bootstrapPairs = new Set(bootstrapCookies.map((cookie) => `${cookie.name}\u0000${cookie.value}`));
  return candidates.find((cookie) => !bootstrapPairs.has(`${cookie.name}\u0000${cookie.value}`)) ?? fallback;
}

function matchesBootstrapPair(
  recoveredCookies: RecoveryCookie[],
  bootstrapCookies: RecoveryCookie[],
): boolean {
  if (bootstrapCookies.length === 0) {
    return false;
  }

  const bootstrapPairs = new Set(bootstrapCookies.map((cookie) => `${cookie.name}\u0000${cookie.value}`));
  return recoveredCookies.every((cookie) => bootstrapPairs.has(`${cookie.name}\u0000${cookie.value}`));
}

function normalizeCookieDomains(domain: string): string[] {
  const normalized = normalizeDomain(domain);
  return normalized.startsWith('.') ? [normalized, normalized.slice(1)] : [normalized, `.${normalized}`];
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase();
}

function manualActionRequiredResult(): RecoveryResult {
  return {
    storageStateUpdated: false,
    manualActionRequired: true,
    recoveryAttempted: true,
    code: 'FLOW_MANUAL_BROWSER_ACTION_REQUIRED',
  };
}

function recoveryNotAttemptedResult(): RecoveryResult {
  return {
    storageStateUpdated: false,
    manualActionRequired: false,
    recoveryAttempted: false,
    code: 'FLOW_PLAYWRIGHT_RECOVERY_FAILED',
  };
}

function recoveryFailedResult(): RecoveryResult {
  return {
    storageStateUpdated: false,
    manualActionRequired: false,
    recoveryAttempted: true,
    code: 'FLOW_PLAYWRIGHT_RECOVERY_FAILED',
  };
}
