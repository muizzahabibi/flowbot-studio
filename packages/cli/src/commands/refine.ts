import { createFlowClient } from '@flowbot-studio/core';
import type { ParsedArgs } from '../utils/args.js';
import { buildClientConfig, requireStringOption } from '../utils/args.js';
import { printInfo, printJson } from '../utils/output.js';

export async function runRefineCommand(parsed: ParsedArgs): Promise<void> {
  const config = buildClientConfig(parsed.options);
  const client = createFlowClient(config);

  const mediaId = requireStringOption(parsed.options, 'media-id');
  const prompt = requireStringOption(parsed.options, 'prompt');

  printInfo('Refining media (workflow placeholder)...');
  const refined = await client.media.refine(mediaId, prompt);
  printJson(refined);
}
