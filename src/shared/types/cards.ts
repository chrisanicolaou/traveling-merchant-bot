import type { UUID } from "node:crypto";
import type { PrintingTraits } from "../enums";

export type Card = {
  id: UUID;
  name: string;
  printings: CardPrinting[];
};

export type CardSet = {
  id: string;
  name: string;
  cardCount?: number;
  riftcodexId?: string;
  tcgPlayerId?: string;
  releaseDate?: Date;
};

export type CardPrinting = {
  id: UUID;
  cardId: UUID;
  set: CardSet;
  riftboundId?: string;
  riftcodexId?: string;
  tcgplayerId?: number;
  imageUrl?: string;
  artist?: string;
  traits: PrintingTraits;
};
