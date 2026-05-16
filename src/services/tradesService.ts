import { and, eq } from "drizzle-orm";
import type { DbConnection } from "../db/dbConnection.ts";
import {
  trades,
  type TradeRow,
  type NewTradeRow,
  type TradeWithDetails,
} from "../db/schema.ts";
import { TradeDirection } from "../shared/enums.ts";

export const MAX_LISTING_QUANTITY = 99;

export class TradeNotFoundError extends Error {
  constructor(tradeId: string) {
    super(`Trade ${tradeId} not found for user`);
    this.name = "TradeNotFoundError";
  }
}

export class TradeQuantityExceededError extends Error {
  constructor(
    public readonly existingQuantity: number,
    public readonly attemptedDelta: number,
  ) {
    super(
      `Listing total ${existingQuantity + attemptedDelta} exceeds the per-listing max of ${MAX_LISTING_QUANTITY}`,
    );
    this.name = "TradeQuantityExceededError";
  }
}

export class TradesService {
  constructor(private readonly db: DbConnection["db"]) {}

  async upsertTrade(
    trade: NewTradeRow,
  ): Promise<{ row: TradeRow; previousQuantity: number | null }> {
    const delta = trade.quantity ?? 1;
    return this.db.transaction(async (tx) => {
      const existing = await tx.query.trades.findFirst({
        where: {
          discordUserId: trade.discordUserId,
          direction: trade.direction,
          printingId: trade.printingId,
        },
      });

      if (existing) {
        const newTotal = existing.quantity + delta;
        if (newTotal > MAX_LISTING_QUANTITY) {
          throw new TradeQuantityExceededError(existing.quantity, delta);
        }
        const [updated] = await tx
          .update(trades)
          .set({ quantity: newTotal })
          .where(eq(trades.id, existing.id))
          .returning();
        if (!updated) {
          throw new Error("Failed to update trade");
        }
        return { row: updated, previousQuantity: existing.quantity };
      }

      if (delta > MAX_LISTING_QUANTITY) {
        throw new TradeQuantityExceededError(0, delta);
      }
      const [inserted] = await tx.insert(trades).values(trade).returning();
      if (!inserted) {
        throw new Error("Failed to insert trade");
      }
      return { row: inserted, previousQuantity: null };
    });
  }

  async getTradesByDiscordUserId(discordUserId: string): Promise<TradeWithDetails[]> {
    return this.db.query.trades.findMany({
      where: {
        discordUserId,
      },
      with: {
        cardPrinting: {
          with: {
            cardData: true,
            set: true,
          },
        },
      },
    });
  }

  async getOpenCounterpartTrades(
    printingId: string,
    direction: TradeDirection,
  ): Promise<TradeRow[]> {
    const counterpart =
      direction === TradeDirection.Buy ? TradeDirection.Sell : TradeDirection.Buy;
    return this.db.query.trades.findMany({
      where: { printingId, direction: counterpart },
    });
  }

  async removeTradeQuantity(
    tradeId: string,
    discordUserId: string,
    quantity?: number,
  ): Promise<{ removed: TradeWithDetails; deleted: boolean }> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.query.trades.findFirst({
        where: { id: tradeId, discordUserId },
        with: {
          cardPrinting: {
            with: {
              cardData: true,
              set: true,
            },
          },
        },
      });
      if (!existing) {
        throw new TradeNotFoundError(tradeId);
      }

      const ownership = and(eq(trades.id, tradeId), eq(trades.discordUserId, discordUserId));

      if (quantity === undefined || quantity >= existing.quantity) {
        await tx.delete(trades).where(ownership);
        return { removed: existing, deleted: true };
      }

      const [updated] = await tx
        .update(trades)
        .set({ quantity: existing.quantity - quantity })
        .where(ownership)
        .returning();
      if (!updated) {
        throw new TradeNotFoundError(tradeId);
      }
      return {
        removed: { ...existing, quantity: updated.quantity },
        deleted: false,
      };
    });
  }
}
