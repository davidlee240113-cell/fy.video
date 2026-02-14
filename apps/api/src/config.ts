import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  STRIPE_PLATFORM_ACCOUNT_ID: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('fyvideo-uploads'),
  R2_PUBLIC_URL: z.string().optional(),
  CF_STREAM_API_TOKEN: z.string().optional(),
  CF_STREAM_ACCOUNT_ID: z.string().optional(),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@fy.video'),
  ENCRYPTION_KEY: z.string().optional(),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    console.error('❌ Invalid environment variables:\n' + missing.join('\n'));
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    // In development, use defaults for optional fields
    return envSchema.parse({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/fyvideo',
      JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production-min32',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-prod-min32',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder',
    });
  }
  return parsed.data;
}

export const config = loadConfig();

export const PLATFORM_FEE_PCT = 10; // 10% platform fee
export const DEFAULT_AFFILIATE_COMMISSION_PCT = 15; // 15% affiliate commission
export const AFFILIATE_HOLD_DAYS = 7; // 7-day hold before commission approval
export const PAYOUT_THRESHOLD_CENTS = 2500; // $25 minimum payout
export const ATTRIBUTION_WINDOW_DAYS = 30; // 30-day cookie window
export const SIGNED_URL_TTL_HOURS = 4;
export const MAX_DEVICES_PER_USER = 3;
export const PURCHASE_COOLDOWN_SECONDS = 5;
export const CLICK_DEDUP_SECONDS = 60;
