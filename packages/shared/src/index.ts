// ─── Shared Types ────────────────────────────────────────────────────────────

export type UserRole = 'viewer' | 'creator' | 'affiliate' | 'admin' | 'enterprise_admin';
export type SeriesStatus = 'draft' | 'published' | 'archived' | 'suspended';
export type SeriesVisibility = 'public' | 'unlisted' | 'private';
export type EpisodeStatus = 'uploading' | 'processing' | 'ready' | 'published' | 'archived';
export type PurchaseStatus = 'pending' | 'completed' | 'refunded' | 'disputed';
export type AffiliateLinkStatus = 'active' | 'paused' | 'revoked';
export type AffiliateEarningStatus = 'pending' | 'approved' | 'paid' | 'reversed';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
}

export interface Series {
  id: string;
  creatorId: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  trailerUrl: string | null;
  status: SeriesStatus;
  visibility: SeriesVisibility;
  fullSeriesPriceCents: number | null;
  currency: string;
  category: string | null;
  tags: string[];
  affiliateEnabled: boolean;
  affiliateCommissionPct: number | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface Episode {
  id: string;
  seriesId: string;
  episodeNumber: number;
  title: string;
  description: string | null;
  isFree: boolean;
  priceCents: number | null;
  currency: string;
  durationSeconds: number | null;
  resolution: string | null;
  thumbnailUrl: string | null;
  status: EpisodeStatus;
  chapters: Array<{ title: string; startSeconds: number }>;
  captions: Array<{ lang: string; url: string }>;
}

export interface Purchase {
  id: string;
  userId: string;
  seriesId: string | null;
  episodeId: string | null;
  amountCents: number;
  currency: string;
  status: PurchaseStatus;
  createdAt: string;
}

export interface AffiliateLink {
  id: string;
  affiliateId: string;
  seriesId: string;
  trackingCode: string;
  customSlug: string | null;
  destinationUrl: string;
  clickCount: number;
  conversionCount: number;
  status: AffiliateLinkStatus;
}

export interface PaywallData {
  episode: {
    id: string;
    title: string;
    durationSeconds: number | null;
    thumbnailUrl: string | null;
    previewUrl: string | null;
  };
  pricing: {
    episodePriceCents: number | null;
    currency: string;
    bundleAvailable: boolean;
    bundlePriceCents: number | null;
    bundleEpisodeCount: number;
    bundleSavingsPct: number;
    promoActive: boolean;
    promoPriceCents: number | null;
    promoExpiresAt: string | null;
  };
  social: {
    unlockCount: number;
    completionRate: number;
  };
  viewer: {
    isAuthenticated: boolean;
    purchasedEpisodeIds: string[];
    hasBundlePurchase: boolean;
  };
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    correlationId?: string;
    details?: unknown;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const PLATFORM_FEE_PCT = 10;
export const DEFAULT_AFFILIATE_COMMISSION_PCT = 15;
export const ATTRIBUTION_WINDOW_DAYS = 30;

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
