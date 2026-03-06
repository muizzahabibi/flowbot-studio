import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { requireApiKey } from '../src/middleware/auth.js';

describe('requireApiKey', () => {
  it('rejects invalid key', async () => {
    const app = Fastify();
    app.get('/protected', async (request, reply) => {
      await requireApiKey(request, reply, 'secret');
      if (reply.sent) return;
      return { ok: true };
    });

    const response = await app.inject({ method: 'GET', url: '/protected' });
    expect(response.statusCode).toBe(401);

    await app.close();
  });
});
