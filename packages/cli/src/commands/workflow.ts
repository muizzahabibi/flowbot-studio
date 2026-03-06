import { createFlowClient } from '@flowbot-studio/core';
import type { ParsedArgs } from '../utils/args.js';
import { buildClientConfig, requireStringOption } from '../utils/args.js';
import { printInfo, printJson } from '../utils/output.js';

export async function runWorkflowCommand(parsed: ParsedArgs): Promise<void> {
  const [action] = parsed.positionals;
  if (action !== 'rename') {
    throw new Error('Usage: flow workflow rename --workflow-id <id> --project-id <id> --name <name>');
  }

  const config = buildClientConfig(parsed.options);
  const client = createFlowClient(config);

  const workflowId = requireStringOption(parsed.options, 'workflow-id');
  const projectId = requireStringOption(parsed.options, 'project-id');
  const displayName = requireStringOption(parsed.options, 'name');

  printInfo('Renaming workflow...');
  const result = await client.media.renameWorkflow(workflowId, projectId, displayName);
  printJson(result);
}
