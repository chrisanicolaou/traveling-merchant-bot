import type {
  CardDataProvider,
  CardDataSyncCard,
  CardDataSyncSet,
} from "../api/card-data/cardDataProvider";
import { eq, inArray, sql } from "drizzle-orm";
import type { AppDb } from "../db/dbConnection";
import {
  cardDatas,
  cardPrintings,
  sets,
  type CardDataRow,
  type CardPrintingRow,
  type NewCardDataRow,
  type NewCardPrintingRow,
  type NewSetRow,
  type ResolvedCardPrinting,
  type SetRow,
} from "../db/schema";
import { PrintingTraits } from "../shared/enums";
import { CacheService } from "./cacheService";
import { PrintingTraitsService } from "./printingTraitsService";
import { normalizeCardName } from "./cardNameNormalization";

export type SyncAllCardsResult = {
  pagesProcessed: number;
  cardsProcessed: number;
  setsInserted: number;
  setsUpdated: number;
  cardDatasInserted: number;
  cardPrintingsInserted: number;
  cardPrintingsUpdated: number;
};

export type SyncProgress = SyncAllCardsResult & {
  currentPage: number;
  totalPages: number;
};

type DbTransaction = Parameters<AppDb["transaction"]>[0] extends (tx: infer T) => Promise<unknown>
  ? T
  : never;

const CARD_NAMES_CACHE_TTL_SECONDS = 24 * 60 * 60;

export const SYNC_CARDS_LOCK_KEY = "sync:cards:lock";
export const SYNC_CARDS_LOCK_TTL_SECONDS = 30 * 60;

export class CardsService {
  private readonly CARD_NAMES_WITH_PRINTINGS_CACHE_KEY = "full_card_names";
  private readonly CARD_NAMES_CACHE_KEY = "card_names";

  constructor(
    private readonly cacheService: CacheService,
    private readonly cardDataProvider: CardDataProvider,
    private readonly printingTraitsService: PrintingTraitsService,
    private readonly db: AppDb,
  ) {}

  async getCardNames(): Promise<string[]> {
    const cached = await this.cacheService.get<string[]>(this.CARD_NAMES_CACHE_KEY);
    if (cached) return cached;

    const rows = await this.db
      .select({ name: cardDatas.name })
      .from(cardDatas)
      .orderBy(cardDatas.name);
    const names = rows.map((r) => r.name);
    await this.cacheService.set(this.CARD_NAMES_CACHE_KEY, names, CARD_NAMES_CACHE_TTL_SECONDS);
    return names;
  }

  async getCardNamesWithPrintings(): Promise<string[]> {
    const cached = await this.cacheService.get<string[]>(this.CARD_NAMES_WITH_PRINTINGS_CACHE_KEY);
    if (cached) return cached;

    const rows = await this.db
      .select({ name: cardDatas.name, traits: cardPrintings.traits })
      .from(cardDatas)
      .innerJoin(cardPrintings, eq(cardPrintings.cardId, cardDatas.id))
      .orderBy(cardDatas.name);

    const seen = new Set<string>();
    const display: string[] = [];
    for (const row of rows) {
      const label = this.formatPrintingDisplayName(row.name, row.traits);
      if (seen.has(label)) continue;
      seen.add(label);
      display.push(label);
    }

    await this.cacheService.set(
      this.CARD_NAMES_WITH_PRINTINGS_CACHE_KEY,
      display,
      CARD_NAMES_CACHE_TTL_SECONDS,
    );
    return display;
  }

  async getPrintingByNameTraitsAndSet(
    cardName: string,
    traits: PrintingTraits,
    setId: string,
  ): Promise<ResolvedCardPrinting | null> {
    const cardData = await this.db.query.cardDatas.findFirst({
      where: { name: cardName },
    });
    if (!cardData) return null;

    const printings = await this.db.query.cardPrintings.findMany({
      where: { cardId: cardData.id, setId },
      with: { cardData: true, set: true },
    });
    if (printings.length === 0) return null;

    const exact = printings.find((p) => p.traits === traits);
    const subsetMatches = printings.filter(
      (p) => p.traits !== PrintingTraits.None && (p.traits & traits) === p.traits,
    );
    const candidate = exact ?? (subsetMatches.length === 1 ? subsetMatches[0] : null);
    if (!candidate) return null;
    if (!candidate.cardData || !candidate.set) {
      throw new Error(`Printing ${candidate.id} missing required cardData or set relation`);
    }
    return candidate as ResolvedCardPrinting;
  }

  async findCanonicalCardName(input: string): Promise<string | null> {
    const normalizedInput = normalizeCardName(input);
    if (normalizedInput.length === 0) return null;

    const names = await this.getCardNames();
    for (const name of names) {
      if (normalizeCardName(name) === normalizedInput) return name;
    }
    return null;
  }

  async getLatestPrintingByName(
    cardName: string,
    traits: PrintingTraits,
  ): Promise<ResolvedCardPrinting | null> {
    const cardData = await this.db.query.cardDatas.findFirst({
      where: { name: cardName },
    });
    if (!cardData) return null;

    const printings = await this.db.query.cardPrintings.findMany({
      where: { cardId: cardData.id, traits },
      with: { cardData: true, set: true },
    });
    if (printings.length === 0) return null;

    const sorted = printings
      .filter((p): p is typeof p & { set: NonNullable<typeof p.set> } => p.set !== null)
      .sort((a, b) => {
        const aTime = a.set.releaseDate?.getTime() ?? -Infinity;
        const bTime = b.set.releaseDate?.getTime() ?? -Infinity;
        return bTime - aTime;
      });
    const candidate = sorted[0];
    if (!candidate) return null;
    if (!candidate.cardData) {
      throw new Error(`Printing ${candidate.id} missing required cardData relation`);
    }
    return candidate as ResolvedCardPrinting;
  }

  async getSetsForCardName(cardName: string): Promise<SetRow[]> {
    const cardData = await this.db.query.cardDatas.findFirst({
      where: { name: cardName },
      with: { printings: { with: { set: true } } },
    });
    if (!cardData) return [];

    const seen = new Set<string>();
    const out: SetRow[] = [];
    for (const printing of cardData.printings) {
      if (!printing.set || seen.has(printing.set.id)) continue;
      seen.add(printing.set.id);
      out.push(printing.set);
    }
    return out;
  }

  async getPrintingOptionsFromCardName(cardName: string): Promise<PrintingTraits> {
    const rows = await this.db
      .select({ traits: cardPrintings.traits })
      .from(cardDatas)
      .innerJoin(cardPrintings, eq(cardPrintings.cardId, cardDatas.id))
      .where(eq(cardDatas.name, cardName));
    return rows.reduce<PrintingTraits>((acc, r) => acc | r.traits, PrintingTraits.None);
  }

  async syncAllCards(onProgress?: (snapshot: SyncProgress) => void): Promise<SyncAllCardsResult> {
    const result: SyncAllCardsResult = {
      pagesProcessed: 0,
      cardsProcessed: 0,
      setsInserted: 0,
      setsUpdated: 0,
      cardDatasInserted: 0,
      cardPrintingsInserted: 0,
      cardPrintingsUpdated: 0,
    };

    const providerSets = await this.cardDataProvider.getSets();
    await this.db.transaction(async (tx) => {
      await this.syncSetsFromList(tx, providerSets, result);
    });

    for (let page = 1; ; page++) {
      const cardPage = await this.cardDataProvider.getCardsPage({
        take: 100,
        sort: "collector_number",
        page,
      });

      if (cardPage.items.length === 0) break;

      console.log(`Syncing card data page ${cardPage.page}/${cardPage.pages}...`);

      await this.syncCardPage(cardPage.items, result);

      result.pagesProcessed++;
      result.cardsProcessed += cardPage.items.length;

      onProgress?.({ ...result, currentPage: cardPage.page, totalPages: cardPage.pages });

      if (cardPage.page >= cardPage.pages) break;
    }

    await this.invalidateCardNameCaches();
    return result;
  }

  private async invalidateCardNameCaches(): Promise<void> {
    await Promise.all([
      this.cacheService.delete(this.CARD_NAMES_CACHE_KEY),
      this.cacheService.delete(this.CARD_NAMES_WITH_PRINTINGS_CACHE_KEY),
    ]);
  }

  private formatPrintingDisplayName(cardName: string, traits: PrintingTraits): string {
    if (traits === PrintingTraits.None || traits === PrintingTraits.Standard) {
      return cardName;
    }
    return `${cardName} (${this.printingTraitsService.formatTraits(traits)})`;
  }

  private async syncCardPage(cards: CardDataSyncCard[], result: SyncAllCardsResult): Promise<void> {
    await this.db.transaction(async (tx) => {
      const cardDataByName = await this.syncCardDatas(tx, cards, result);
      await this.syncCardPrintings(tx, cards, cardDataByName, result);
    });
  }

  private async syncSetsFromList(
    tx: DbTransaction,
    providerSets: CardDataSyncSet[],
    result: SyncAllCardsResult,
  ): Promise<void> {
    if (providerSets.length === 0) return;

    const setIds = providerSets.map((s) => s.id);
    const existingSets = await tx.select().from(sets).where(inArray(sets.id, setIds));
    const existingMap = new Map(existingSets.map((s) => [s.id, s]));
    const newSets: NewSetRow[] = [];

    for (const providerSet of providerSets) {
      const existing = existingMap.get(providerSet.id);
      const next: NewSetRow = {
        id: providerSet.id,
        name: providerSet.name,
        riftcodexId: providerSet.riftcodexId,
        tcgPlayerId: providerSet.tcgPlayerId,
        cardCount: providerSet.cardCount,
        releaseDate: providerSet.releaseDate,
      };

      if (!existing) {
        newSets.push(next);
        continue;
      }

      if (hasSetChanged(existing, next)) {
        await tx.update(sets).set(next).where(eq(sets.id, providerSet.id));
        result.setsUpdated++;
      }
    }

    if (newSets.length > 0) {
      await tx.insert(sets).values(newSets);
      result.setsInserted += newSets.length;
    }
  }

  private async syncCardDatas(
    tx: DbTransaction,
    cards: CardDataSyncCard[],
    result: SyncAllCardsResult,
  ): Promise<Map<string, CardDataRow>> {
    const uniqueCardNames = Array.from(new Set(cards.map((card) => card.name)));

    if (uniqueCardNames.length === 0) {
      return new Map();
    }

    const existingCardDatas = await tx
      .select()
      .from(cardDatas)
      .where(inArray(cardDatas.name, uniqueCardNames));
    const cardDataByName = new Map(existingCardDatas.map((cardData) => [cardData.name, cardData]));
    const missingCardDatas: NewCardDataRow[] = uniqueCardNames
      .filter((cardName) => !cardDataByName.has(cardName))
      .map((cardName) => ({ name: cardName }));

    if (missingCardDatas.length > 0) {
      const insertedCardDatas = await tx.insert(cardDatas).values(missingCardDatas).returning();

      for (const insertedCardData of insertedCardDatas) {
        cardDataByName.set(insertedCardData.name, insertedCardData);
      }

      result.cardDatasInserted += insertedCardDatas.length;
    }

    return cardDataByName;
  }

  private async syncCardPrintings(
    tx: DbTransaction,
    cards: CardDataSyncCard[],
    cardDataByName: Map<string, CardDataRow>,
    result: SyncAllCardsResult,
  ): Promise<void> {
    const uniqueCards = Array.from(new Map(cards.map((card) => [card.riftboundId, card])).values());
    const riftboundIds = uniqueCards.map((card) => card.riftboundId);

    if (riftboundIds.length === 0) {
      return;
    }

    const existingCardPrintings = await tx
      .select()
      .from(cardPrintings)
      .where(inArray(cardPrintings.riftboundId, riftboundIds));
    const existingCardPrintingMap = new Map<string, CardPrintingRow>();

    for (const existingCardPrinting of existingCardPrintings) {
      if (existingCardPrinting.riftboundId) {
        existingCardPrintingMap.set(existingCardPrinting.riftboundId, existingCardPrinting);
      }
    }

    const newCardPrintings: NewCardPrintingRow[] = [];

    for (const card of uniqueCards) {
      const cardData = cardDataByName.get(card.name);

      if (!cardData) {
        throw new Error(`Card data row not found for card "${card.name}"`);
      }

      const nextPrintingValues: NewCardPrintingRow = {
        cardId: cardData.id,
        setId: card.setId,
        riftboundId: card.riftboundId,
        riftcodexId: card.riftcodexId,
        tcgplayerId: card.tcgplayerId,
        imageUrl: card.imageUrl,
        artist: card.artist,
        traits: card.traits,
      };
      const existingCardPrinting = existingCardPrintingMap.get(card.riftboundId);

      if (!existingCardPrinting) {
        newCardPrintings.push(nextPrintingValues);
        continue;
      }

      if (hasCardPrintingChanged(existingCardPrinting, nextPrintingValues)) {
        await tx
          .update(cardPrintings)
          .set(nextPrintingValues)
          .where(eq(cardPrintings.riftboundId, card.riftboundId));
        result.cardPrintingsUpdated++;
      }
    }

    if (newCardPrintings.length > 0) {
      await tx.insert(cardPrintings).values(newCardPrintings);
      result.cardPrintingsInserted += newCardPrintings.length;
    }
  }
}

function hasSetChanged(existing: SetRow, next: NewSetRow): boolean {
  return (
    existing.name !== next.name ||
    existing.riftcodexId !== (next.riftcodexId ?? null) ||
    existing.tcgPlayerId !== (next.tcgPlayerId ?? null) ||
    existing.cardCount !== (next.cardCount ?? null) ||
    !datesEqual(existing.releaseDate, next.releaseDate ?? null)
  );
}

function datesEqual(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.getTime() === b.getTime();
}

function hasCardPrintingChanged(
  existingCardPrinting: CardPrintingRow,
  nextPrintingValues: NewCardPrintingRow,
): boolean {
  return (
    existingCardPrinting.cardId !== nextPrintingValues.cardId ||
    existingCardPrinting.setId !== nextPrintingValues.setId ||
    existingCardPrinting.riftboundId !== nextPrintingValues.riftboundId ||
    existingCardPrinting.riftcodexId !== nextPrintingValues.riftcodexId ||
    existingCardPrinting.tcgplayerId !== nextPrintingValues.tcgplayerId ||
    existingCardPrinting.imageUrl !== nextPrintingValues.imageUrl ||
    existingCardPrinting.artist !== nextPrintingValues.artist ||
    existingCardPrinting.traits !== nextPrintingValues.traits
  );
}
