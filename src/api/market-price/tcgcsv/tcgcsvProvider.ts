import { ApiClient } from "../../apiClient";
import type { CacheService } from "../../../services/cacheService";
import type { MarketPrice, MarketPriceProvider } from "../marketPriceProvider";
import {
  TcgcsvCategoriesResponse,
  TcgcsvGroupsResponse,
  TcgcsvPricesResponse,
  type SerializedPriceMap,
} from "./types";

const PRICE_MAP_CACHE_KEY = "tcgcsv:price_map";
const PRICE_MAP_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_RIFTBOUND_CATEGORY_NAME = "Riftbound";
const USER_AGENT = "traveling-merchant-bot/1.0.0";

export type TcgcsvProviderOptions = {
  cache: CacheService;
  categoryIdOverride?: number;
  categoryNameMatch?: string;
};

export class TcgcsvProvider implements MarketPriceProvider {
  private readonly client = new ApiClient("https://tcgcsv.com/tcgplayer");
  private readonly headers = new Headers({ "User-Agent": USER_AGENT });
  private readonly cache: CacheService;
  private readonly categoryIdOverride?: number;
  private readonly categoryNameMatch: string;
  private priceMap: Map<number, MarketPrice> | null = null;
  private inFlightInit: Promise<Map<number, MarketPrice>> | null = null;

  constructor(options: TcgcsvProviderOptions) {
    this.cache = options.cache;
    this.categoryIdOverride = options.categoryIdOverride;
    this.categoryNameMatch = options.categoryNameMatch ?? DEFAULT_RIFTBOUND_CATEGORY_NAME;
  }

  async getPriceByTcgplayerId(tcgplayerId: number): Promise<MarketPrice | null> {
    const map = await this.getPriceMap();
    return map.get(tcgplayerId) ?? null;
  }

  private async getPriceMap(): Promise<Map<number, MarketPrice>> {
    if (this.priceMap) return this.priceMap;
    this.inFlightInit ??= this.loadPriceMap();
    this.priceMap = await this.inFlightInit;
    this.inFlightInit = null;
    return this.priceMap;
  }

  private async loadPriceMap(): Promise<Map<number, MarketPrice>> {
    const cached = await this.cache.get<SerializedPriceMap>(PRICE_MAP_CACHE_KEY);
    if (cached) {
      console.log("Cache hit for tcgcsv price map");
      return deserializePriceMap(cached);
    }

    console.log("Cache miss for tcgcsv price map. Fetching from tcgcsv...");
    const map = await this.fetchPriceMap();
    await this.cache.set(PRICE_MAP_CACHE_KEY, serializePriceMap(map), PRICE_MAP_TTL_SECONDS);
    return map;
  }

  private async fetchPriceMap(): Promise<Map<number, MarketPrice>> {
    const categoryId = this.categoryIdOverride ?? (await this.resolveCategoryId());
    const groupIds = await this.fetchGroupIds(categoryId);
    const fetchedAt = new Date();
    const map = new Map<number, MarketPrice>();

    for (const groupId of groupIds) {
      const prices = await this.fetchGroupPrices(categoryId, groupId);
      for (const entry of prices) {
        const existing = map.get(entry.productId);
        const isNormal = (entry.subTypeName ?? "").toLowerCase().includes("normal");
        if (existing && !isNormal) continue;
        if (entry.marketPriceCents === null) continue;
        map.set(entry.productId, {
          marketPriceCents: entry.marketPriceCents,
          currency: "USD",
          fetchedAt,
        });
      }
    }

    return map;
  }

  private async resolveCategoryId(): Promise<number> {
    const response = await this.client.get("/categories", undefined, this.headers);
    if (!response.ok) {
      throw new Error(`tcgcsv categories request failed with status ${response.status}`);
    }
    const parsed = TcgcsvCategoriesResponse.parse(await response.json());
    const needle = this.categoryNameMatch.toLowerCase();
    const match = parsed.results.find((c) => c.name.toLowerCase().includes(needle));
    if (!match) {
      throw new Error(`tcgcsv: no category found matching "${this.categoryNameMatch}"`);
    }
    return match.categoryId;
  }

  private async fetchGroupIds(categoryId: number): Promise<number[]> {
    const response = await this.client.get(`/${categoryId}/groups`, undefined, this.headers);
    if (!response.ok) {
      throw new Error(`tcgcsv groups request failed with status ${response.status}`);
    }
    const parsed = TcgcsvGroupsResponse.parse(await response.json());
    return parsed.results.map((g) => g.groupId);
  }

  private async fetchGroupPrices(
    categoryId: number,
    groupId: number,
  ): Promise<Array<{ productId: number; marketPriceCents: number | null; subTypeName: string | null }>> {
    const response = await this.client.get(`/${categoryId}/${groupId}/prices`, undefined, this.headers);
    if (!response.ok) {
      throw new Error(`tcgcsv prices request failed with status ${response.status}`);
    }
    const parsed = TcgcsvPricesResponse.parse(await response.json());
    return parsed.results.map((entry) => ({
      productId: entry.productId,
      marketPriceCents: entry.marketPrice != null ? Math.round(entry.marketPrice * 100) : null,
      subTypeName: entry.subTypeName ?? null,
    }));
  }
}

function serializePriceMap(map: Map<number, MarketPrice>): SerializedPriceMap {
  const out: SerializedPriceMap = {};
  for (const [productId, price] of map) {
    out[String(productId)] = {
      marketPriceCents: price.marketPriceCents,
      fetchedAt: price.fetchedAt.toISOString(),
    };
  }
  return out;
}

function deserializePriceMap(serialized: SerializedPriceMap): Map<number, MarketPrice> {
  const map = new Map<number, MarketPrice>();
  for (const [productId, value] of Object.entries(serialized)) {
    map.set(Number(productId), {
      marketPriceCents: value.marketPriceCents,
      currency: "USD",
      fetchedAt: new Date(value.fetchedAt),
    });
  }
  return map;
}
