import fs from 'node:fs';
import { createFlowClient } from '@flowbot-studio/core';
import type { ParsedArgs } from '../utils/args.js';
import { buildClientConfig, getNumberOption, getStringOption } from '../utils/args.js';
import { printInfo, printJson } from '../utils/output.js';

export async function runCaptionCommand(parsed: ParsedArgs): Promise<void> {
  const config = buildClientConfig(parsed.options);
  const client = createFlowClient(config);

  const imagePath = getStringOption(parsed.options, 'image');
  const base64Input = getStringOption(parsed.options, 'base64');
  const count = getNumberOption(parsed.options, 'count') ?? 1;

  let rawImageBytes: string;
  if (base64Input) {
    rawImageBytes = base64Input.includes(',') ? base64Input.split(',').pop() ?? '' : base64Input;
  } else if (imagePath) {
    const bytes = fs.readFileSync(imagePath);
    rawImageBytes = bytes.toString('base64');
  } else {
    throw new Error('Provide --image <path> or --base64 <data>');
  }

  printInfo('Generating caption(s)...');
  const captions = await client.media.caption(rawImageBytes, count);
  printJson({ captions });
}
