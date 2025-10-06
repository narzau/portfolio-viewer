import settings from '../../config/settings';

type UnpaidTotalResponse = { amount: number };
type SettingsResponse = { currency?: string };

export class TimeTrackingService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = settings.TIME_TRACKING_API_BASE_URL;
    this.apiKey = settings.TIME_TRACKING_API_KEY;

    if (!this.baseUrl) {
      console.error('TIME_TRACKING_API_BASE_URL is not set.');
    }
    if (!this.apiKey) {
      console.error('TIME_TRACKING_API_KEY is not set.');
    }
  }

  private buildUrl(path: string): string {
    const normalizedBase = this.baseUrl?.replace(/\/$/, '') || '';
    return `${normalizedBase}${path}`;
  }

  private async request<T>(path: string): Promise<T> {
    const url = this.buildUrl(path);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      // Surface meaningful errors based on status codes
      if (response.status === 401) {
        throw new Error('Unauthorized (401) when calling Time Tracking API.');
      }
      if (response.status === 422) {
        throw new Error(`Unprocessable Entity (422): ${bodyText}`);
      }
      throw new Error(`Time Tracking API error ${response.status}: ${bodyText}`);
    }

    return (await response.json()) as T;
  }

  async getUnpaidTotal(): Promise<number> {
    const data = await this.request<UnpaidTotalResponse>(
      '/api/v1/time-tracking/unpaid-total'
    );
    const amount = typeof data.amount === 'number' ? data.amount : 0;
    return amount;
  }

  async getSettings(): Promise<{ currency: string | null }> {
    const data = await this.request<SettingsResponse>(
      '/api/v1/time-tracking/settings'
    );
    return { currency: data.currency ?? null };
  }

  // Compatibility method to replace GoogleSheetsService.getUnclaimedGains
  // We map the new API's unpaid total to approvedGains and set notInvoicedGains to 0
  // to avoid double counting, as the new API does not provide a separate figure.
  async getUnclaimedGains(): Promise<{
    approvedGains: number;
    notInvoicedGains: number;
  }> {
    const amount = await this.getUnpaidTotal();
    return {
      approvedGains: amount,
      notInvoicedGains: 0
    };
  }
}


