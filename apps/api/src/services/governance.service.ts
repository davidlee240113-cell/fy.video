import { createHash, createHmac, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors.js';
import { config, SIGNED_URL_TTL_HOURS } from '../config.js';
import type { AccessPolicy, AccessPolicyType } from '@prisma/client';

export interface CreatePolicyInput {
  seriesId: string;
  policyType: AccessPolicyType;
  rules: Record<string, unknown>;
  priority?: number;
}

export class GovernanceService {
  async createPolicy(createdBy: string, input: CreatePolicyInput): Promise<AccessPolicy> {
    const series = await prisma.series.findUnique({ where: { id: input.seriesId } });
    if (!series) throw new NotFoundError('Series');

    return prisma.accessPolicy.create({
      data: {
        seriesId: input.seriesId,
        policyType: input.policyType,
        rules: input.rules,
        priority: input.priority ?? 0,
        createdBy,
      },
    });
  }

  async listPolicies(seriesId: string) {
    return prisma.accessPolicy.findMany({
      where: { seriesId },
      orderBy: { priority: 'asc' },
    });
  }

  async updatePolicy(
    policyId: string,
    userId: string,
    data: { rules?: Record<string, unknown>; isActive?: boolean; priority?: number },
  ): Promise<AccessPolicy> {
    const policy = await prisma.accessPolicy.findUnique({ where: { id: policyId } });
    if (!policy) throw new NotFoundError('Access policy');

    return prisma.accessPolicy.update({
      where: { id: policyId },
      data: {
        ...(data.rules !== undefined && { rules: data.rules }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.priority !== undefined && { priority: data.priority }),
      },
    });
  }

  async evaluatePolicies(
    seriesId: string,
    context: { ipAddress: string; country?: string; deviceType?: string; domain?: string; userId?: string },
  ): Promise<{ allowed: boolean; reason?: string }> {
    const policies = await prisma.accessPolicy.findMany({
      where: { seriesId, isActive: true },
      orderBy: { priority: 'asc' },
    });

    for (const policy of policies) {
      const rules = policy.rules as Record<string, unknown>;

      switch (policy.policyType) {
        case 'geo_restrict': {
          const allowed = rules['allowedCountries'] as string[] | undefined;
          const blocked = rules['blockedCountries'] as string[] | undefined;
          if (context.country) {
            if (allowed && !allowed.includes(context.country)) {
              return { allowed: false, reason: 'Content not available in your region' };
            }
            if (blocked && blocked.includes(context.country)) {
              return { allowed: false, reason: 'Content not available in your region' };
            }
          }
          break;
        }
        case 'device_limit': {
          const maxDevices = (rules['maxDevices'] as number) || 3;
          if (context.userId) {
            const activeDevices = await prisma.viewerProgress.count({
              where: {
                userId: context.userId,
                lastWatchedAt: { gt: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
              },
            });
            if (activeDevices >= maxDevices) {
              return { allowed: false, reason: `Maximum ${maxDevices} devices reached` };
            }
          }
          break;
        }
        case 'ip_whitelist': {
          const whitelist = rules['allowedIps'] as string[] | undefined;
          if (whitelist && !whitelist.some((cidr) => isIpInCidr(context.ipAddress, cidr))) {
            return { allowed: false, reason: 'Access restricted by IP policy' };
          }
          break;
        }
        case 'time_window': {
          const start = rules['startDate'] ? new Date(rules['startDate'] as string) : null;
          const end = rules['endDate'] ? new Date(rules['endDate'] as string) : null;
          const now = new Date();
          if (start && now < start) {
            return { allowed: false, reason: 'Content not yet available' };
          }
          if (end && now > end) {
            return { allowed: false, reason: 'Content access has expired' };
          }
          break;
        }
        case 'domain_lock': {
          const domains = rules['allowedDomains'] as string[] | undefined;
          if (context.domain && domains && !domains.includes(context.domain)) {
            return { allowed: false, reason: 'Playback not allowed on this domain' };
          }
          break;
        }
      }
    }

    return { allowed: true };
  }

  generateSignedPlaybackUrl(
    videoAssetId: string,
    userId: string,
    ipAddress: string,
    sessionId: string,
  ): string {
    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_HOURS * 60 * 60;
    const payload = `${videoAssetId}:${userId}:${ipAddress}:${sessionId}:${expiresAt}`;
    const signature = createHmac('sha256', config.JWT_SECRET)
      .update(payload)
      .digest('hex');

    // In production, this would generate a Cloudflare Stream signed URL
    // For now, return a structured URL
    return `https://stream.fy.video/${videoAssetId}?token=${signature}&expires=${expiresAt}&uid=${userId}`;
  }

  async createAuditLog(
    actorId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    changes?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        resourceType,
        resourceId,
        changes: changes || {},
        ipAddress,
        userAgent,
      },
    });
  }

  async getAuditLog(filters: {
    actorId?: string;
    resourceType?: string;
    resourceId?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters.actorId) where['actorId'] = filters.actorId;
    if (filters.resourceType) where['resourceType'] = filters.resourceType;
    if (filters.resourceId) where['resourceId'] = filters.resourceId;
    if (filters.action) where['action'] = { contains: filters.action };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, displayName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data: logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}

function isIpInCidr(ip: string, cidr: string): boolean {
  // Simplified CIDR check — in production use a library like ip-cidr
  if (!cidr.includes('/')) return ip === cidr;
  const [range, bits] = cidr.split('/');
  if (!range || !bits) return false;
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  const ipNum = ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0);
  const rangeNum = range.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0);
  return (ipNum & mask) === (rangeNum & mask);
}

export const governanceService = new GovernanceService();
