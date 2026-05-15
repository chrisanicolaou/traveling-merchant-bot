import type { DbConnection } from "../db/dbConnection.ts";
import { trades, type TradeRow, type NewTradeRow, type TradeWithDetails } from "../db/schema.ts";
import { TradeDirection } from "../shared/enums.ts";

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
}
