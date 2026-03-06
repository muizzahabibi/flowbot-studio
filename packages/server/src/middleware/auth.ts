import type { FastifyReply, FastifyRequest } from 'fastify';

function extractBearerToken(value?: string): string | undefined {
  if (!value) return undefined;
  if (!value.toLowerCase().startsWith('bearer ')) return undefined;
  return value.slice('Bearer '.length).trim();
}

export async function requireApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
  apiKey?: string,
): Promise<void> {
  if (!apiKey) return;

  const auth = request.headers.authorization;
  const token = extractBearerToken(auth);

  if (!token || token !== apiKey) {
    await reply.code(401).send({
      error: {
        message: 'Invalid API key',
        type: 'authentication_error',
        code: 'invalid_api_key',
      },
    });
  }
}
