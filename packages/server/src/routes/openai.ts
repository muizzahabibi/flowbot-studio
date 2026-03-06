import type { FastifyInstance } from 'fastify';
import { createFlowClient } from '@flowbot-studio/core';
import { requireApiKey } from '../middleware/auth.js';

interface OpenAIRoutesOptions {
  apiKey?: string | undefined;
}

export async function registerOpenAIRoutes(
  app: FastifyInstance,
  options: OpenAIRoutesOptions,
): Promise<void> {
  app.get('/v1/models', async () => {
    return {
      object: 'list',
      data: [
        { id: 'nano-banana', object: 'model', owned_by: 'google' },
        { id: 'nano-banana-r2i', object: 'model', owned_by: 'google' },
        { id: 'IMAGEN_4', object: 'model', owned_by: 'google' },
      ],
    };
  });

  app.post('/v1/images/generations', async (request, reply) => {
    await requireApiKey(request, reply, options.apiKey);
    if (reply.sent) return;

    const body = request.body as {
      model: string;
      prompt: string;
      n?: number;
      size?: '1024x1024' | '1024x1792' | '1792x1024';
      response_format?: 'b64_json' | 'url';
      seed?: number;
      user?: string;
      project_id?: string;
      recaptcha_token?: string;
      references?: string[];
    };

    const client = createFlowClient();
    const result = await client.openai.generate(body);
    return result;
  });

  app.post('/v1/images/image-edit', async (request, reply) => {
    await requireApiKey(request, reply, options.apiKey);
    if (reply.sent) return;

    const body = request.body as {
      model: string;
      prompt: string;
      images: string[];
      n?: number;
      size?: '1024x1024' | '1024x1792' | '1792x1024';
      response_format?: 'b64_json' | 'url';
      seed?: number;
      user?: string;
      project_id?: string;
      recaptcha_token?: string;
    };

    const client = createFlowClient();
    const result = await client.openai.imageEdit(body);
    return result;
  });
}
