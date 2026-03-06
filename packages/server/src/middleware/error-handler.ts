import { FlowError } from '@flowbot-studio/core';
import type { FastifyReply, FastifyRequest } from 'fastify';

export function registerErrorHandler(app: {
  setErrorHandler: (
    handler: (error: Error, request: FastifyRequest, reply: FastifyReply) => void,
  ) => void;
}): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof FlowError) {
      reply.code(error.statusCode ?? 500).send({
        error: {
          message: error.message,
          type: 'upstream_error',
          code: error.endpoint,
        },
      });
      return;
    }

    reply.code(500).send({
      error: {
        message: error.message || 'Internal server error',
        type: 'internal_error',
      },
    });
  });
}
