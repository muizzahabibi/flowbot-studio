import { createFlowClient } from '@flowbot-studio/core';
import type { ParsedArgs } from '../utils/args.js';
import {
  buildClientConfig,
  getNumberOption,
  getStringArrayOption,
  getStringOption,
  requireStringOption,
} from '../utils/args.js';
import { printInfo, printJson } from '../utils/output.js';

const RECAPTCHA_SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';
const RECAPTCHA_CO = 'aHR0cHM6Ly9sYWJzLmdvb2dsZTo0NDM.';
const RECAPTCHA_VERSION = 'QvLuXwupqtKMva7GIh5eGl3U';

async function fetchRecaptchaToken(): Promise<string> {
  const siteKey = RECAPTCHA_SITE_KEY;
  const co = RECAPTCHA_CO;
  const version = RECAPTCHA_VERSION;
  const cb = Math.random().toString(36).slice(2);

  const anchorUrl =
    `https://www.google.com/recaptcha/enterprise/anchor?ar=1&k=${siteKey}` +
    `&co=${encodeURIComponent(co)}&hl=en&v=${version}&size=invisible&cb=${cb}`;

  const anchorResponse = await fetch(anchorUrl, {
    headers: {
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9,id-ID;q=0.8,id;q=0.7',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    },
  });

  const anchorText = await anchorResponse.text();
  const anchorTokenMatch = anchorText.match(/id="recaptcha-token"[^>]*value="([^"]+)"/);
  const anchorToken = anchorTokenMatch?.[1];
  if (!anchorToken) {
    throw new Error('Failed to get reCAPTCHA anchor token');
  }

  const body = new URLSearchParams({
    v: version,
    reason: 'q',
    k: siteKey,
    c: anchorToken,
    sa: 'IMAGE_GENERATION',
    co,
  });

  const reloadResponse = await fetch(`https://www.google.com/recaptcha/enterprise/reload?k=${siteKey}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      referer:
        `https://www.google.com/recaptcha/enterprise/anchor?ar=1&k=${siteKey}` +
        `&co=${co}&hl=en&v=${version}&size=invisible&anchor-ms=20000&execute-ms=30000&cb=l7qwgzhkq6fu`,
    },
    body,
  });

  const reloadText = await reloadResponse.text();
  const tokenMatch = reloadText.match(/"rresp","([^"]+)"/);
  const token = tokenMatch?.[1];

  if (!token) {
    throw new Error('Failed to get reCAPTCHA token');
  }

  return token;
}

export async function runGenerateCommand(parsed: ParsedArgs): Promise<void> {
  const config = buildClientConfig(parsed.options);
  const client = createFlowClient(config);

  const projectId = requireStringOption(parsed.options, 'project-id');
  const prompt = requireStringOption(parsed.options, 'prompt');
  const seed = getNumberOption(parsed.options, 'seed');
  const model = getStringOption(parsed.options, 'model') ?? 'nano-banana';
  const references = getStringArrayOption(parsed.options, 'reference');
  const userProvidedRecaptchaToken = getStringOption(parsed.options, 'recaptcha-token');

  const createPayload = (token: string) => {
    const payload: {
      model: string;
      prompt: string;
      project_id: string;
      recaptcha_token: string;
      seed?: number;
      references?: string[];
      response_format: 'b64_json';
    } = {
      model,
      prompt,
      project_id: projectId,
      recaptcha_token: token,
      response_format: 'b64_json',
    };

    if (seed !== undefined) payload.seed = seed;
    if (references.length) payload.references = references;
    return payload;
  };

  let recaptchaToken = userProvidedRecaptchaToken;
  if (!recaptchaToken) {
    printInfo('Generating reCAPTCHA token...');
    recaptchaToken = await fetchRecaptchaToken();
  }

  try {
    printInfo('Generating images...');
    const response = await client.openai.generate(createPayload(recaptchaToken));
    printInfo(`Generated ${response.data.length} image(s)`);
    printJson(response);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldRetry =
      !userProvidedRecaptchaToken &&
      /recaptcha/i.test(message) &&
      /(failed|invalid|required|denied|forbidden|permission|403)/i.test(message);

    if (!shouldRetry) {
      throw error;
    }

    printInfo('reCAPTCHA rejected by upstream, regenerating token and retrying once...');
    const refreshedToken = await fetchRecaptchaToken();

    printInfo('Generating images...');
    const response = await client.openai.generate(createPayload(refreshedToken));
    printInfo(`Generated ${response.data.length} image(s)`);
    printJson(response);
  }
}
