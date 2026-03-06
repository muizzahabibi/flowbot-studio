import { createFlowClient } from '@google-flow-suite/core';
import type { ParsedArgs } from '../utils/args.js';
import { buildClientConfig, requireStringOption } from '../utils/args.js';

export async function runAnimateCommand(parsed: ParsedArgs): Promise<void> {
  const config = buildClientConfig(parsed.options);
  const client = createFlowClient(config);

  const mediaId = requireStringOption(parsed.options, 'media-id');
  await client.media.animate(mediaId);
}
