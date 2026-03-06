import { createFlowClient } from '@flowbot-studio/core';
import type { ParsedArgs } from '../utils/args.js';
import { buildClientConfig, getStringOption } from '../utils/args.js';
import { printInfo, printJson } from '../utils/output.js';

export async function runProjectCommand(parsed: ParsedArgs): Promise<void> {
  const [action] = parsed.positionals;
  if (action !== 'create') {
    throw new Error('Usage: flow project create --name <display-name>');
  }

  const config = buildClientConfig(parsed.options);
  const client = createFlowClient(config);
  const displayName = getStringOption(parsed.options, 'name');

  const project = await client.createProject(displayName);
  printInfo('Project created');
  printJson({ projectId: project.projectId, sessionId: project.sessionId });
}
