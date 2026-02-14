import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../lib/errors.js';
import type { User, UserRole, MagicLinkPurpose } from '@prisma/client';

const BCRYPT_ROUNDS = 12;
const MAGIC_LINK_EXPIRY_HOURS = 72;

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
  role?: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<User> {
    const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        displayName: input.displayName,
        role: input.role || 'viewer',
      },
    });

    return user;
  }

  async login(input: LoginInput): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedError('Account is not active');
    }

    const validPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.mfaEnabled) {
      if (!input.mfaCode) {
        throw new ValidationError('MFA code required');
      }
      const { authenticator } = await import('otplib');
      if (!user.mfaSecret || !authenticator.verify({ token: input.mfaCode, secret: user.mfaSecret })) {
        throw new UnauthorizedError('Invalid MFA code');
      }
    }

    return user;
  }

  async createRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(48).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return token;
  }

  async validateRefreshToken(token: string): Promise<string> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const stored = await prisma.refreshToken.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
    });

    if (!stored) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    return stored.userId;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async createMagicLink(email: string, purpose: MagicLinkPurpose): Promise<string> {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new NotFoundError('User');
    }

    const token = randomBytes(48).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.magicLinkToken.create({
      data: { userId: user.id, tokenHash, purpose, expiresAt },
    });

    return token;
  }

  async validateMagicLink(token: string, purpose: MagicLinkPurpose): Promise<User> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const magicLink = await prisma.magicLinkToken.findFirst({
      where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!magicLink) {
      throw new UnauthorizedError('Invalid or expired magic link');
    }

    await prisma.magicLinkToken.update({
      where: { id: magicLink.id },
      data: { usedAt: new Date() },
    });

    return magicLink.user;
  }

  async findOrCreateViewerByEmail(email: string, referredByAffiliateId?: string): Promise<User> {
    const normalizedEmail = email.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          role: 'viewer',
          referredByAffiliateId,
        },
      });
    }

    return user;
  }

  async upgradeToAffiliate(userId: string): Promise<User> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    if (user.role === 'affiliate' || user.role === 'creator') {
      // Already has affiliate permissions
      return user;
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        role: 'affiliate',
        affiliateApprovedAt: new Date(),
      },
    });
  }

  async verifyEmail(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }

  async initiatePasswordReset(email: string): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return null; // Don't reveal whether email exists

    return this.createMagicLink(email, 'password_reset');
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.validateMagicLink(token, 'password_reset');
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await this.revokeAllRefreshTokens(user.id);
  }
}

export const authService = new AuthService();
