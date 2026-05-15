export type MarketPrice = {
  marketPriceCents: number;
  currency: string;
  fetchedAt: Date;
};

export interface MarketPriceProvider {
  getPriceByTcgplayerId(tcgplayerId: number): Promise<MarketPrice | null>;
}
