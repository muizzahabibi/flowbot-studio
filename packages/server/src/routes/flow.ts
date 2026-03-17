import type { FastifyInstance } from 'fastify';
import { createFlowClient } from '@flowbot-studio/core';
import { requireApiKey } from '../middleware/auth.js';
import { FlowRecoveryOrchestrator, type FlowGenerateRetryInput } from '../services/flow-recovery-orchestrator.js';

type FlowModel = 'NARWHAL' | 'IMAGEN_3_5' | 'GEM_PIX' | 'R2I';

type GenerateRequestBody = {
  prompt: string;
  recaptcha_token: string;
  seed?: number;
  model?: FlowModel;
  references?: string[];
};

type GenerateBaseOptions = {
  seed?: number;
  model?: FlowModel;
};

type GenerateReference = {
  imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE';
  name: string;
};

interface FlowRoutesOptions {
  apiKey?: string | undefined;
  recoveryOrchestrator?: Pick<FlowRecoveryOrchestrator, 'runGenerateWithRecovery'>;
}

function createGenerateBaseOptions(body: {
  seed?: number;
  model?: FlowModel;
}): GenerateBaseOptions {
  const options: GenerateBaseOptions = {};

  if (body.seed !== undefined) {
    options.seed = body.seed;
  }

  if (body.model !== undefined) {
    options.model = body.model;
  }

  return options;
}

function createFlowReferences(references: string[] | undefined): GenerateReference[] {
  return (references ?? []).map((name) => ({
    imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE',
    name,
  }));
}

export async function registerFlowRoutes(
  app: FastifyInstance,
  options: FlowRoutesOptions,
): Promise<void> {
  app.post('/flow/projects', async (request, reply) => {
    await requireApiKey(request, reply, options.apiKey);
    if (reply.sent) return;

    const body = request.body as {
      displayName?: string;
    };

    const client = createFlowClient();
    const project = await client.createProject(body.displayName);
    return { projectId: project.projectId };
  });

  app.get('/flow/media/:mediaId/content', async (request, reply) => {
    await requireApiKey(request, reply, options.apiKey);
    if (reply.sent) return;

    const { mediaId } = request.params as { mediaId: string };
    const client = createFlowClient();
    const bytes = await client.media.save(mediaId);
    reply.header('content-type', 'application/octet-stream');
    return reply.send(bytes);
  });

  app.post('/flow/projects/:projectId/generate', async (request, reply) => {
    await requireApiKey(request, reply, options.apiKey);
    if (reply.sent) return;

    const { projectId } = request.params as { projectId: string };
    const body = request.body as GenerateRequestBody;

    const references = createFlowReferences(body.references);

    const generateBaseOptions = createGenerateBaseOptions(body);
    const recoveryOrchestrator = options.recoveryOrchestrator;

    const runGenerate = async (retryInput?: FlowGenerateRetryInput) => {
      const clientConfig = retryInput?.cookieHeader
        ? {
            cookie: retryInput.cookieHeader,
          }
        : undefined;
      const client = createFlowClient(clientConfig);
      const project = client.project(projectId);
      const recaptchaToken = retryInput?.recaptchaToken ?? body.recaptcha_token;

      return await project.generateImageWithReferences(body.prompt, references, {
        ...generateBaseOptions,
        recaptchaToken,
      });
    };

    if (!recoveryOrchestrator) {
      return await runGenerate();
    }

    return await recoveryOrchestrator.runGenerateWithRecovery({
      recaptchaToken: body.recaptcha_token,
      generate: runGenerate,
    });
  });

  app.patch('/flow/workflows/:workflowId', async (request, reply) => {
    await requireApiKey(request, reply, options.apiKey);
    if (reply.sent) return;

    const { workflowId } = request.params as { workflowId: string };
    const body = request.body as { projectId: string; displayName: string };

    const client = createFlowClient();
    const result = await client.media.renameWorkflow(workflowId, body.projectId, body.displayName);
    return result;
  });
}
