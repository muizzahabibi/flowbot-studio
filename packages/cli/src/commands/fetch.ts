import path from 'node:path';
import { createFlowClient } from '@flowbot-studio/core';
import type { ParsedArgs } from '../utils/args.js';
import { buildClientConfig, getStringOption, requireStringOption } from '../utils/args.js';
import { printInfo, printJson, writeBinaryFile } from '../utils/output.js';

export async function runFetchCommand(parsed: ParsedArgs): Promise<void> {
  const config = buildClientConfig(parsed.options);
  const client = createFlowClient(config);

  const mediaId = requireStringOption(parsed.options, 'media-id');
  const output = getStringOption(parsed.options, 'output');

  printInfo('Fetching media redirect...');
  const redirect = await client.media.fetchById(mediaId);
  printJson({ mediaId, redirect });

  if (output) {
    printInfo('Downloading media bytes...');
    const buffer = await client.media.save(mediaId);
    const target = path.resolve(output);
    writeBinaryFile(target, buffer);
    printInfo(`Saved: ${target}`);
  }
}
