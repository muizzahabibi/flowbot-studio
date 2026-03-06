#!/usr/bin/env node
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - dotenv-safe has no bundled types in this workspace.
import { config as loadEnv } from 'dotenv-safe';
import { parseCliArgs } from './utils/args.js';
import { printError, printInfo } from './utils/output.js';
import { runProjectCommand } from './commands/project.js';
import { runGenerateCommand } from './commands/generate.js';
import { runRefineCommand } from './commands/refine.js';
import { runCaptionCommand } from './commands/caption.js';
import { runUploadCommand } from './commands/upload.js';
import { runFetchCommand } from './commands/fetch.js';
import { runDeleteCommand } from './commands/delete.js';
import { runWorkflowCommand } from './commands/workflow.js';
import { runAnimateCommand } from './commands/animate.js';

function printHelp(): void {
  printInfo(`flow CLI

Commands:
  flow project create --name <name>
  flow generate --project-id <id> --prompt <text> --recaptcha-token <token> [--model nano-banana]
  flow refine --media-id <id> --prompt <text>
  flow caption (--image <path> | --base64 <data>) [--count 1]
  flow upload --project-id <id> --image <path> [--mime-type image/jpeg]
  flow fetch --media-id <id> [--output ./out.png]
  flow delete --media-id <id>
  flow workflow rename --workflow-id <id> --project-id <id> --name <name>
  flow animate --media-id <id>

Common options:
  --cookie <cookie>
  --bearer-token <token>
  --google-api-key <key>
  --telemetry enabled|disabled
  --retries <n>
  --timeout-ms <ms>
`);
}

async function main(): Promise<void> {
  try {
    try {
      loadEnv({
        allowEmptyValues: true,
        example: '.env.example',
        path: '.env',
      });
    } catch {
      // Optional env file.
    }

    const argv = process.argv.slice(2);
    const [command, ...rest] = argv;

    if (!command || command === '--help' || command === '-h' || command === 'help') {
      printHelp();
      return;
    }

    const parsed = parseCliArgs(rest);

    switch (command) {
      case 'project':
        await runProjectCommand(parsed);
        break;
      case 'generate':
        await runGenerateCommand(parsed);
        break;
      case 'refine':
        await runRefineCommand(parsed);
        break;
      case 'caption':
        await runCaptionCommand(parsed);
        break;
      case 'upload':
        await runUploadCommand(parsed);
        break;
      case 'fetch':
        await runFetchCommand(parsed);
        break;
      case 'delete':
        await runDeleteCommand(parsed);
        break;
      case 'workflow':
        await runWorkflowCommand(parsed);
        break;
      case 'animate':
        await runAnimateCommand(parsed);
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

void main();
