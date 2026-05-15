import { ApiClient } from "../../apiClient";
import type { CacheService } from "../../../services/cacheService";
import type { ExchangeRateProvider } from "../exchangeRateProvider";
import { FrankfurterRateResponse } from "./types";

const RATE_TTL_SECONDS = 24 * 60 * 60;

export type FrankfurterProviderOptions = {
  cache: CacheService;
};

export class FrankfurterProvider implements ExchangeRateProvider {
  private readonly client = new ApiClient("https://api.frankfurter.dev/v2");
  private readonly cache: CacheService;
  private readonly memo = new Map<string, number>();
  private readonly inFlight = new Map<string, Promise<number>>();

  constructor(options: FrankfurterProviderOptions) {
    this.cache = options.cache;
  }

  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    const key = cacheKey(from, to);
    const memoed = this.memo.get(key);
    if (memoed !== undefined) return memoed;

    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = this.loadRate(from, to, key);
      this.inFlight.set(key, pending);
    }
    try {
      const rate = await pending;
      this.memo.set(key, rate);
      return rate;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async loadRate(from: string, to: string, key: string): Promise<number> {
    const cached = await this.cache.get<number>(key);
    if (cached !== null) {
      console.log(`Cache hit for exchange rate ${from}->${to}`);
      return cached;
    }

    console.log(`Cache miss for exchange rate ${from}->${to}. Fetching from frankfurter...`);
    const rate = await this.fetchRate(from, to);
    await this.cache.set(key, rate, RATE_TTL_SECONDS);
    return rate;
  }

  private async fetchRate(from: string, to: string): Promise<number> {
    const response = await this.client.get(`/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`);
    if (!response.ok) {
      throw new Error(
        `frankfurter rate request for ${from}->${to} failed with status ${response.status}`,
      );
    }
    const parsed = FrankfurterRateResponse.parse(await response.json());
    return parsed.rate;
  }
}

function cacheKey(from: string, to: string): string {
  return `fx:${from.toUpperCase()}:${to.toUpperCase()}`;
}
