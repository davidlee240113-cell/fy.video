import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '@prisma/client';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userRole?: UserRole;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const token = extractToken(request);
    if (!token) {
      throw new UnauthorizedError('Missing authentication token');
    }
    const decoded = await request.jwtVerify<{ sub: string; role: UserRole }>();
    request.userId = decoded.sub;
    request.userRole = decoded.role;
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export async function optionalAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    const token = extractToken(request);
    if (token) {
      const decoded = await request.jwtVerify<{ sub: string; role: UserRole }>();
      request.userId = decoded.sub;
      request.userRole = decoded.role;
    }
  } catch {
    // Token invalid or expired — continue as unauthenticated
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    await authenticate(request, _reply);
    if (!request.userRole || !roles.includes(request.userRole)) {
      throw new ForbiddenError(`Required role: ${roles.join(' or ')}`);
    }
  };
}

function extractToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}
