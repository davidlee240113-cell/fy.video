import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { ZodError } from 'zod';

export function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const correlationId = request.id;

  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        correlationId,
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
        correlationId,
      },
    });
    return;
  }

  // Fastify validation errors
  if ('validation' in error && error.validation) {
    reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        correlationId,
      },
    });
    return;
  }

  // Unexpected errors
  logger.error({ err: error, correlationId, url: request.url }, 'Unhandled error');
  reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      correlationId,
    },
  });
}
