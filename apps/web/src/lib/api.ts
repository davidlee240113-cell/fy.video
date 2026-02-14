const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.accessToken = token;
  }

  getToken(): string | null {
    return this.accessToken;
  }

  private async fetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;

    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });

    if (response.status === 401 && this.accessToken) {
      // Try refreshing the token
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retryResponse = await fetch(url, { ...fetchOptions, headers, credentials: 'include' });
        if (!retryResponse.ok) {
          throw await this.parseError(retryResponse);
        }
        return retryResponse.json();
      }
    }

    if (!response.ok) {
      throw await this.parseError(response);
    }

    if (response.status === 204) return {} as T;
    return response.json();
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        this.accessToken = data.accessToken;
        if (typeof window !== 'undefined') {
          localStorage.setItem('fy_token', data.accessToken);
        }
        return true;
      }
    } catch {}
    return false;
  }

  private async parseError(response: Response) {
    try {
      const data = await response.json();
      return { status: response.status, ...data.error };
    } catch {
      return { status: response.status, message: response.statusText };
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────────

  async register(email: string, password: string, displayName?: string, role?: string) {
    const data = await this.fetch<{ user: Record<string, unknown>; accessToken: string }>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName, role }),
    });
    this.accessToken = data.accessToken;
    return data;
  }

  async login(email: string, password: string, mfaCode?: string) {
    const data = await this.fetch<{ user: Record<string, unknown>; accessToken: string }>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, mfaCode }),
    });
    this.accessToken = data.accessToken;
    return data;
  }

  async logout() {
    await this.fetch('/v1/auth/logout', { method: 'POST' });
    this.accessToken = null;
  }

  // ── Series ────────────────────────────────────────────────────────────

  async listSeries(params?: Record<string, string>) {
    return this.fetch<{ data: unknown[]; pagination: unknown }>('/v1/series', { params });
  }

  async getSeries(slug: string) {
    return this.fetch<{ data: unknown }>(`/v1/series/${slug}`);
  }

  async createSeries(data: Record<string, unknown>) {
    return this.fetch<{ data: unknown }>('/v1/series', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateSeries(id: string, data: Record<string, unknown>) {
    return this.fetch<{ data: unknown }>(`/v1/series/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async publishSeries(id: string) {
    return this.fetch<{ data: unknown }>(`/v1/series/${id}/publish`, { method: 'POST' });
  }

  // ── Episodes ──────────────────────────────────────────────────────────

  async createEpisode(seriesId: string, data: Record<string, unknown>) {
    return this.fetch<{ data: unknown }>(`/v1/series/${seriesId}/episodes`, { method: 'POST', body: JSON.stringify(data) });
  }

  async getEpisode(id: string) {
    return this.fetch<{ data: unknown }>(`/v1/episodes/${id}`);
  }

  async getEpisodePaywall(id: string) {
    return this.fetch<{ data: unknown }>(`/v1/episodes/${id}/paywall`);
  }

  async getPlaybackUrl(id: string) {
    return this.fetch<{ data: { playbackUrl: string } }>(`/v1/episodes/${id}/playback`);
  }

  async getUploadUrl(episodeId: string) {
    return this.fetch<{ data: { uploadUrl: string; key: string } }>(`/v1/episodes/${episodeId}/upload-url`, { method: 'POST' });
  }

  // ── Purchases ─────────────────────────────────────────────────────────

  async purchaseEpisode(episodeId: string, idempotencyKey: string, affiliateCode?: string) {
    return this.fetch<{ data: { clientSecret: string; purchaseId: string } }>(`/v1/purchases/episode/${episodeId}`, {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey, affiliateCode }),
    });
  }

  async purchaseSeries(seriesId: string, idempotencyKey: string, affiliateCode?: string) {
    return this.fetch<{ data: { clientSecret: string; purchaseId: string } }>(`/v1/purchases/series/${seriesId}`, {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey, affiliateCode }),
    });
  }

  async checkAccess(episodeId: string) {
    return this.fetch<{ data: { hasAccess: boolean } }>(`/v1/episodes/${episodeId}/access`);
  }

  async listPurchases(params?: Record<string, string>) {
    return this.fetch<{ data: unknown[]; pagination: unknown }>('/v1/purchases', { params });
  }

  // ── Affiliate ─────────────────────────────────────────────────────────

  async instantAffiliate(email: string, seriesId: string, source?: string) {
    return this.fetch<{ data: unknown }>('/v1/affiliate/instant', {
      method: 'POST',
      body: JSON.stringify({ email, seriesId, source }),
    });
  }

  async getAffiliateLinks() {
    return this.fetch<{ data: unknown[] }>('/v1/affiliate/links');
  }

  async getAffiliateDashboard() {
    return this.fetch<{ data: unknown }>('/v1/affiliate/dashboard');
  }

  async getAffiliateEarnings() {
    return this.fetch<{ data: unknown }>('/v1/affiliate/earnings');
  }

  async recordShare(affiliateLinkId: string, platform: string) {
    return this.fetch('/v1/affiliate/share', {
      method: 'POST',
      body: JSON.stringify({ affiliateLinkId, platform }),
    });
  }

  // ── Analytics ─────────────────────────────────────────────────────────

  async sendEvents(events: unknown[]) {
    return this.fetch('/v1/analytics/events', { method: 'POST', body: JSON.stringify({ events }) });
  }

  async updateProgress(episodeId: string, watchedSeconds: number, deviceType?: string) {
    return this.fetch('/v1/analytics/progress', {
      method: 'POST',
      body: JSON.stringify({ episodeId, watchedSeconds, deviceType }),
    });
  }

  async getSeriesAnalytics(seriesId: string, days?: number) {
    return this.fetch<{ data: unknown }>(`/v1/analytics/series/${seriesId}`, {
      params: days ? { days: days.toString() } : undefined,
    });
  }

  async getRevenueAnalytics(days?: number) {
    return this.fetch<{ data: unknown }>('/v1/analytics/revenue', {
      params: days ? { days: days.toString() } : undefined,
    });
  }
}

export const api = new ApiClient(API_URL);

// Initialize token from localStorage on client side
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('fy_token');
  if (stored) api.setToken(stored);
}
