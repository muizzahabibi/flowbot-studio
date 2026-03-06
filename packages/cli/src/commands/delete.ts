import { createFlowClient } from '@flowbot-studio/core';
import type { ParsedArgs } from '../utils/args.js';
import { buildClientConfig, requireStringOption } from '../utils/args.js';
import { printInfo, printJson } from '../utils/output.js';

export async function runDeleteCommand(parsed: ParsedArgs): Promise<void> {
  const config = buildClientConfig(parsed.options);
  const client = createFlowClient(config);

  const mediaId = requireStringOption(parsed.options, 'media-id');
  await client.media.delete(mediaId);
  printInfo('Media deleted');
  printJson({ mediaId, deleted: true });
}
