import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).optional(),
  role: z.enum(['viewer', 'creator']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  mfaCode: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const user = await authService.register(body);

    const accessToken = app.jwt.sign(
      { sub: user.id, role: user.role },
      { expiresIn: '15m' },
    );
    const refreshToken = await authService.createRefreshToken(user.id);

    reply.setCookie('fy_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/v1/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.status(201).send({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      accessToken,
    });
  });

  app.post('/v1/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await authService.login(body);

    const accessToken = app.jwt.sign(
      { sub: user.id, role: user.role },
      { expiresIn: '15m' },
    );
    const refreshToken = await authService.createRefreshToken(user.id);

    reply.setCookie('fy_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/v1/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
    });
  });

  app.post('/v1/auth/refresh', async (request, reply) => {
    const refreshToken = (request.cookies as Record<string, string>)['fy_refresh'];
    if (!refreshToken) {
      return reply.status(401).send({ error: { message: 'No refresh token' } });
    }

    const userId = await authService.validateRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return reply.status(401).send({ error: { message: 'User not found' } });
    }

    const accessToken = app.jwt.sign({ sub: user.id, role: user.role }, { expiresIn: '15m' });
    await authService.revokeRefreshToken(refreshToken);
    const newRefreshToken = await authService.createRefreshToken(userId);

    reply.setCookie('fy_refresh', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/v1/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({ accessToken });
  });

  app.post('/v1/auth/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const refreshToken = (request.cookies as Record<string, string>)['fy_refresh'];
    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }
    reply.clearCookie('fy_refresh', { path: '/v1/auth' });
    return reply.send({ success: true });
  });

  app.post('/v1/auth/forgot-password', async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);
    await authService.initiatePasswordReset(email);
    return reply.send({ message: 'If that email exists, a reset link has been sent.' });
  });

  app.post('/v1/auth/verify-email', async (request, reply) => {
    const { token } = z.object({ token: z.string() }).parse(request.body);
    const user = await authService.validateMagicLink(token, 'email_verify');
    await authService.verifyEmail(user.id);
    return reply.send({ success: true });
  });

  app.get('/v1/auth/magic/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const user = await authService.validateMagicLink(token, 'dashboard_access');

    const accessToken = app.jwt.sign({ sub: user.id, role: user.role }, { expiresIn: '15m' });
    const refreshToken = await authService.createRefreshToken(user.id);

    reply.setCookie('fy_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/v1/auth',
      maxAge: 30 * 24 * 60 * 60,
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    return reply.redirect(`${appUrl}/dashboard?token=${accessToken}`);
  });

  app.post('/v1/auth/mfa/enable', { preHandler: [authenticate] }, async (request, reply) => {
    const { authenticator } = await import('otplib');
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(request.userId!, 'fy.video', secret);
    const QRCode = await import('qrcode');
    const qrCodeUrl = await QRCode.toDataURL(otpauth);
    return reply.send({ secret, qrCodeUrl, otpauth });
  });

  app.post('/v1/auth/mfa/verify', { preHandler: [authenticate] }, async (request, reply) => {
    const { secret, code } = z.object({ secret: z.string(), code: z.string() }).parse(request.body);
    const { authenticator } = await import('otplib');
    const isValid = authenticator.verify({ token: code, secret });
    if (!isValid) {
      return reply.status(400).send({ error: { message: 'Invalid MFA code' } });
    }
    await prisma.user.update({
      where: { id: request.userId },
      data: { mfaEnabled: true, mfaSecret: secret },
    });
    return reply.send({ success: true });
  });
}
