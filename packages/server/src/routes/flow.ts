import type { FastifyInstance } from 'fastify';
import { createFlowClient } from '@google-flow-suite/core';
import { requireApiKey } from '../middleware/auth.js';

interface FlowRoutesOptions {
  apiKey?: string | undefined;
}

export async function registerFlowRoutes(
  app: FastifyInstance,
  options: FlowRoutesOptions,
): Promise<void> {
  app.post('/flow/projects/:projectId/generate', async (request, reply) => {
    await requireApiKey(request, reply, options.apiKey);
    if (reply.sent) return;

    const { projectId } = request.params as { projectId: string };
    const body = request.body as {
      prompt: string;
      recaptcha_token: string;
      seed?: number;
      model?: 'NARWHAL' | 'IMAGEN_3_5' | 'GEM_PIX' | 'R2I';
      references?: string[];
    };

    const client = createFlowClient();
    const project = client.project(projectId);

    const references = (body.references ?? []).map((name) => ({
      imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE' as const,
      name,
    }));

    const generateOptions: {
      recaptchaToken: string;
      seed?: number;
      model?: 'NARWHAL' | 'IMAGEN_3_5' | 'GEM_PIX' | 'R2I';
    } = {
      recaptchaToken: body.recaptcha_token,
    };

    if (body.seed !== undefined) generateOptions.seed = body.seed;
    if (body.model !== undefined) generateOptions.model = body.model;

    const result = await project.generateImageWithReferences(
      body.prompt,
      references,
      generateOptions,
    );

    return result;
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
