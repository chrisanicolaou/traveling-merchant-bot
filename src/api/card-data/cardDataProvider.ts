import type { PrintingTraits } from "../../shared/enums";

export type CardDataSyncPageRequest = {
  take: number;
  sort: "collector_number";
  page: number;
};

export type CardDataSyncSet = {
  id: string;
  name: string;
  riftcodexId: string | null;
  tcgPlayerId: string | null;
  cardCount: number | null;
  releaseDate: Date | null;
};

export type CardDataSyncCard = {
  name: string;
  riftcodexId: string;
  riftboundId: string;
  tcgplayerId: number | null;
  imageUrl: string | null;
  artist: string | null;
  traits: PrintingTraits;
  setId: string;
};

export type CardDataSyncPage = {
  items: CardDataSyncCard[];
  total: number;
  page: number;
  size: number;
  pages: number;
};

export interface CardDataProvider {
  // TODO - deprecated; autocomplete now sources from DB. Kept for interface stability.
  getCardNames(): Promise<string[]>;
  getSets(): Promise<CardDataSyncSet[]>;
  // TODO - create domain object for card data. Decide what I actually want from underlying APIs
  getCardByName(cardName: string): Promise<any>;
  getCardsPage(params: CardDataSyncPageRequest): Promise<CardDataSyncPage>;
}
