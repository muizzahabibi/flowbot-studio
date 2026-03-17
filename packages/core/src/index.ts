// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - dotenv-safe has no bundled types in this workspace.
import { config as loadEnv } from 'dotenv-safe';
import { Account } from './domain/account.js';
import { Project } from './domain/project.js';
import type { PromptBuilderInput } from './domain/prompt.js';
import { Media } from './domain/media.js';
import { Prompt } from './domain/prompt.js';
import { FlowAuthSession } from './auth/flow-auth-session.js';
import { FlowHttpClient } from './client/flow-http-client.js';
import { FlowEndpoints } from './client/flow-endpoints.js';
import { FlowTelemetry } from './telemetry/flow-telemetry.js';
import { OpenAIImageAdapter } from './adapters/openai-image-adapter.js';
import type { FlowClientConfig } from './types/flow.js';

export * from './types/flow.js';
export * from './utils/errors.js';
export type { FlowAuthErrorOptions, FlowErrorCode, FlowErrorOptions, FlowErrorSource } from './utils/errors.js';
export type { PromptBuilderInput };
export { Account, Project, Media, Prompt, FlowAuthSession, FlowHttpClient, FlowEndpoints, FlowTelemetry, OpenAIImageAdapter };

export interface FlowClient {
  account: Account;
  authSession: FlowAuthSession;
  httpClient: FlowHttpClient;
  endpoints: FlowEndpoints;
  telemetry: FlowTelemetry;
  media: Media;
  openai: OpenAIImageAdapter;
  project(projectId: string): Project;
  createProject(displayName?: string): Promise<Project>;
  prompt(input: PromptBuilderInput): Prompt;
}

export function createFlowClient(config: FlowClientConfig = {}): FlowClient {
  const envEnabled =
    typeof process !== 'undefined' &&
    (process.env.FLOW_COOKIE || process.env.FLOW_BEARER_TOKEN || process.env.FLOW_GOOGLE_API_KEY);

  if (envEnabled) {
    try {
      loadEnv({
        allowEmptyValues: true,
        example: '.env.example',
        path: '.env',
      });
    } catch {
      // Environment file is optional for library consumers.
    }
  }

  const merged: FlowClientConfig = {
    cookie: config.cookie ?? process.env.FLOW_COOKIE,
    bearerToken: config.bearerToken ?? process.env.FLOW_BEARER_TOKEN,
    googleApiKey: config.googleApiKey ?? process.env.FLOW_GOOGLE_API_KEY,
    apiBaseUrl: config.apiBaseUrl ?? process.env.FLOW_API_BASE_URL,
    trpcBaseUrl: config.trpcBaseUrl ?? process.env.FLOW_TRPC_BASE_URL,
    telemetryMode:
      config.telemetryMode ??
      (process.env.FLOW_TELEMETRY_MODE === 'disabled' ? 'disabled' : 'enabled'),
    retries: config.retries ?? 3,
    timeoutMs: config.timeoutMs ?? {
      default: 30_000,
      upload: 60_000,
      generate: 90_000,
      fetch: 30_000,
    },
  };

  const account = new Account(merged);
  const authSession = account.authSession;
  const httpClient = new FlowHttpClient({ config: merged, authSession });
  const endpoints = new FlowEndpoints({
    client: httpClient,
    googleApiKey: merged.googleApiKey,
  });
  const telemetry = new FlowTelemetry({ mode: merged.telemetryMode, client: httpClient });
  const media = new Media({ endpoints });

  const projectFactory = (projectId: string) => new Project({ projectId, endpoints });
  const openai = new OpenAIImageAdapter({ projectFactory });

  return {
    account,
    authSession,
    httpClient,
    endpoints,
    telemetry,
    media,
    openai,
    project: projectFactory,
    createProject: async (displayName?: string) =>
      Project.create(displayName ? { displayName, endpoints } : { endpoints }),
    prompt: (input: PromptBuilderInput) => new Prompt(input),
  };
}
