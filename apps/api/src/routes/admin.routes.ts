import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { governanceService } from '../services/governance.service.js';
import { requireRole } from '../middleware/auth.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // List users
  app.get('/v1/admin/users', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const page = parseInt(query['page'] || '1');
    const limit = parseInt(query['limit'] || '50');
    const search = query['search'];

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          status: true,
          emailVerified: true,
          createdAt: true,
          _count: { select: { purchases: true, affiliateLinks: true, series: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return reply.send({
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // Update user status/role
  app.patch('/v1/admin/users/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      role: z.enum(['viewer', 'creator', 'affiliate', 'admin', 'enterprise_admin']).optional(),
      status: z.enum(['active', 'suspended', 'deactivated']).optional(),
    }).parse(request.body);

    const user = await prisma.user.update({
      where: { id },
      data: body,
      select: { id: true, email: true, role: true, status: true },
    });

    await governanceService.createAuditLog(
      request.userId!,
      'user.update',
      'user',
      id,
      body,
      request.ip,
      request.headers['user-agent'],
    );

    return reply.send({ data: user });
  });

  // Platform-wide purchases
  app.get('/v1/admin/purchases', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const page = parseInt(query['page'] || '1');
    const limit = parseInt(query['limit'] || '50');

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          series: { select: { id: true, title: true } },
          episode: { select: { id: true, title: true, episodeNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.purchase.count(),
    ]);

    return reply.send({
      data: purchases,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // Trigger payout batch
  app.post('/v1/admin/payouts/batch', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    // Find all approved earnings not yet paid
    const approvedEarnings = await prisma.affiliateEarning.findMany({
      where: { status: 'approved' },
      include: { affiliate: { select: { id: true, stripeAccountId: true, accruedBalanceCents: true } } },
    });

    if (approvedEarnings.length === 0) {
      return reply.send({ data: { message: 'No approved earnings to pay out', count: 0 } });
    }

    // Group by affiliate
    const affiliatePayouts = new Map<string, { total: number; earningIds: string[]; stripeAccountId: string | null }>();
    for (const earning of approvedEarnings) {
      const existing = affiliatePayouts.get(earning.affiliateId);
      if (existing) {
        existing.total += earning.commissionCents;
        existing.earningIds.push(earning.id);
      } else {
        affiliatePayouts.set(earning.affiliateId, {
          total: earning.commissionCents,
          earningIds: [earning.id],
          stripeAccountId: earning.affiliate.stripeAccountId,
        });
      }
    }

    // Create payout batch record
    const batch = await prisma.payoutBatch.create({
      data: {
        totalAmount: Array.from(affiliatePayouts.values()).reduce((sum, p) => sum + p.total, 0),
        affiliateCount: affiliatePayouts.size,
        status: 'processing',
      },
    });

    // Mark earnings as paid
    const earningIds = approvedEarnings.map((e) => e.id);
    await prisma.affiliateEarning.updateMany({
      where: { id: { in: earningIds } },
      data: { status: 'paid', payoutBatchId: batch.id, paidAt: new Date() },
    });

    await governanceService.createAuditLog(
      request.userId!,
      'payout.batch_created',
      'payout_batch',
      batch.id,
      { affiliateCount: affiliatePayouts.size, totalAmount: batch.totalAmount },
      request.ip,
      request.headers['user-agent'],
    );

    return reply.status(201).send({
      data: {
        batchId: batch.id,
        affiliateCount: affiliatePayouts.size,
        totalAmountCents: batch.totalAmount,
      },
    });
  });

  // Audit log
  app.get('/v1/admin/audit-log', { preHandler: [requireRole('admin', 'enterprise_admin')] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const result = await governanceService.getAuditLog({
      actorId: query['actor_id'],
      resourceType: query['resource_type'],
      resourceId: query['resource_id'],
      action: query['action'],
      page: parseInt(query['page'] || '1'),
      limit: parseInt(query['limit'] || '50'),
    });
    return reply.send(result);
  });

  // Governance policies
  app.post('/v1/governance/policies', { preHandler: [requireRole('admin', 'enterprise_admin')] }, async (request, reply) => {
    const body = z.object({
      seriesId: z.string().uuid(),
      policyType: z.enum(['geo_restrict', 'device_limit', 'ip_whitelist', 'time_window', 'domain_lock', 'watermarking']),
      rules: z.record(z.unknown()),
      priority: z.number().int().optional(),
    }).parse(request.body);

    const policy = await governanceService.createPolicy(request.userId!, body);

    await governanceService.createAuditLog(
      request.userId!,
      'policy.created',
      'access_policy',
      policy.id,
      { policyType: body.policyType, rules: body.rules },
      request.ip,
      request.headers['user-agent'],
    );

    return reply.status(201).send({ data: policy });
  });

  app.get('/v1/governance/policies', { preHandler: [requireRole('admin', 'enterprise_admin')] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    if (!query['series_id']) {
      return reply.status(400).send({ error: { message: 'series_id query param required' } });
    }
    const policies = await governanceService.listPolicies(query['series_id']);
    return reply.send({ data: policies });
  });

  app.patch('/v1/governance/policies/:id', { preHandler: [requireRole('admin', 'enterprise_admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      rules: z.record(z.unknown()).optional(),
      isActive: z.boolean().optional(),
      priority: z.number().int().optional(),
    }).parse(request.body);

    const policy = await governanceService.updatePolicy(id, request.userId!, body);
    return reply.send({ data: policy });
  });
}
