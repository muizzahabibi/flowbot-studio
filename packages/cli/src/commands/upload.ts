import fs from 'node:fs';
import { createFlowClient } from '@google-flow-suite/core';
import type { ParsedArgs } from '../utils/args.js';
import { buildClientConfig, getStringOption, requireStringOption } from '../utils/args.js';
import { guessMimeType, printInfo, printJson } from '../utils/output.js';

export async function runUploadCommand(parsed: ParsedArgs): Promise<void> {
  const config = buildClientConfig(parsed.options);
  const client = createFlowClient(config);

  const projectId = requireStringOption(parsed.options, 'project-id');
  const imagePath = requireStringOption(parsed.options, 'image');
  const mimeType = getStringOption(parsed.options, 'mime-type') ?? guessMimeType(imagePath);

  const bytes = fs.readFileSync(imagePath);
  const base64 = bytes.toString('base64');

  const project = client.project(projectId);
  printInfo('Uploading reference image...');
  const mediaId = await project.uploadReference({
    rawImageBytes: base64,
    mimeType,
  });

  printJson({ mediaId });
}
