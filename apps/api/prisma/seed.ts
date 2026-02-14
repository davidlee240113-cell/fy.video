import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fy.video' },
    update: {},
    create: {
      email: 'admin@fy.video',
      passwordHash: await bcrypt.hash('admin123456', 12),
      displayName: 'Platform Admin',
      role: 'admin',
      emailVerified: true,
      status: 'active',
    },
  });
  console.log(`Admin user: ${admin.email}`);

  // Create demo creator
  const creator = await prisma.user.upsert({
    where: { email: 'creator@example.com' },
    update: {},
    create: {
      email: 'creator@example.com',
      passwordHash: await bcrypt.hash('creator123456', 12),
      displayName: 'Demo Creator',
      role: 'creator',
      emailVerified: true,
      status: 'active',
    },
  });
  console.log(`Creator user: ${creator.email}`);

  // Create demo series
  const series = await prisma.series.upsert({
    where: { slug: 'mastering-typescript' },
    update: {},
    create: {
      creatorId: creator.id,
      title: 'Mastering TypeScript',
      slug: 'mastering-typescript',
      description: 'A comprehensive deep-dive into TypeScript for professional developers. Learn advanced types, patterns, and real-world techniques.',
      status: 'published',
      visibility: 'public',
      fullSeriesPriceCents: 4999,
      currency: 'USD',
      category: 'Technology',
      tags: ['typescript', 'programming', 'web development'],
      affiliateEnabled: true,
      affiliateCommissionPct: 15,
      publishedAt: new Date(),
    },
  });
  console.log(`Series: ${series.title}`);

  // Create episodes
  const episodes = [
    { title: 'Introduction to Advanced TypeScript', isFree: true, priceCents: null, durationSeconds: 1200 },
    { title: 'Type System Deep Dive', isFree: true, priceCents: null, durationSeconds: 1800 },
    { title: 'Generics and Conditional Types', isFree: false, priceCents: 799, durationSeconds: 2400 },
    { title: 'Template Literal Types', isFree: false, priceCents: 799, durationSeconds: 1500 },
    { title: 'Declaration Merging & Module Augmentation', isFree: false, priceCents: 799, durationSeconds: 2100 },
    { title: 'Advanced Patterns for React', isFree: false, priceCents: 999, durationSeconds: 3000 },
    { title: 'Type-Safe API Design', isFree: false, priceCents: 999, durationSeconds: 2700 },
    { title: 'Performance & Build Optimization', isFree: false, priceCents: 799, durationSeconds: 1800 },
  ];

  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i]!;
    await prisma.episode.upsert({
      where: { seriesId_episodeNumber: { seriesId: series.id, episodeNumber: i + 1 } },
      update: {},
      create: {
        seriesId: series.id,
        episodeNumber: i + 1,
        title: ep.title,
        description: `Episode ${i + 1} of Mastering TypeScript.`,
        isFree: ep.isFree,
        priceCents: ep.priceCents,
        currency: 'USD',
        durationSeconds: ep.durationSeconds,
        resolution: '1080p',
        status: 'published',
      },
    });
  }
  console.log(`Created ${episodes.length} episodes`);

  // Create demo viewer
  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@example.com' },
    update: {},
    create: {
      email: 'viewer@example.com',
      passwordHash: await bcrypt.hash('viewer123456', 12),
      displayName: 'Demo Viewer',
      role: 'viewer',
      emailVerified: true,
      status: 'active',
    },
  });
  console.log(`Viewer user: ${viewer.email}`);

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
