import { FlowError } from '@flowbot-studio/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ErrorBody } from '../types.js';

export function registerErrorHandler(app: {
  setErrorHandler: (
    handler: (error: Error, request: FastifyRequest, reply: FastifyReply) => void,
  ) => void;
}): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof FlowError) {
      const payload: ErrorBody = {
        error: {
          message: error.message,
          type: 'upstream_error',
        },
      };

      if (error.code !== undefined) {
        payload.error.code = error.code;
      }
      if (error.retryable !== undefined) {
        payload.error.retryable = error.retryable;
      }

      const recoveryDetails = parseRecoveryDetails(error.details);
      if (recoveryDetails) {
        payload.error.recoveryAttempted = recoveryDetails.recoveryAttempted;
        payload.error.manualActionRequired = recoveryDetails.manualActionRequired;
        payload.error.recoveryInProgress = false;
      }

      reply.code(error.statusCode ?? 500).send(payload);
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

function parseRecoveryDetails(details: unknown):
  | {
      recoveryAttempted: boolean;
      manualActionRequired: boolean;
    }
  | undefined {
  if (!details || typeof details !== 'object') {
    return undefined;
  }

  const candidate = details as {
    recoveryAttempted?: unknown;
    manualActionRequired?: unknown;
  };

  if (typeof candidate.recoveryAttempted !== 'boolean' || typeof candidate.manualActionRequired !== 'boolean') {
    return undefined;
  }

  return {
    recoveryAttempted: candidate.recoveryAttempted,
    manualActionRequired: candidate.manualActionRequired,
  };
}
