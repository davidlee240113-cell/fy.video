import Redis from 'ioredis';
import { config } from '../config.js';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true,
  });

if (config.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

export async function connectRedis(): Promise<void> {
  try {
    if (redis.status === 'ready') return;
    await redis.connect();
  } catch {
    console.warn('⚠️  Redis connection failed — running without cache');
  }
}
