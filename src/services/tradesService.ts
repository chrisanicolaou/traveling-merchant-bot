import { and, eq } from "drizzle-orm";
import type { DbConnection } from "../db/dbConnection.ts";
import {
  trades,
  type TradeRow,
  type NewTradeRow,
  type TradeWithDetails,
} from "../db/schema.ts";
import { TradeDirection } from "../shared/enums.ts";

export class TradeNotFoundError extends Error {
  constructor(tradeId: string) {
    super(`Trade ${tradeId} not found for user`);
    this.name = "TradeNotFoundError";
  }
}

export class TradesService {
  constructor(private readonly db: DbConnection["db"]) {}

  async createTrade(trade: NewTradeRow): Promise<TradeRow> {
    const [createdTrade] = await this.db.insert(trades).values(trade).returning();

    if (!createdTrade) {
      throw new Error("Failed to create trade");
    }

    return createdTrade;
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
