import type { DbConnection } from "../db/dbConnection.ts";
import { trades, type TradeRow, type NewTradeRow } from "../db/schema.ts";

export class TradesService {
  constructor(private readonly db: DbConnection["db"]) {}

  async createTrade(trade: NewTradeRow): Promise<TradeRow> {
    const [createdTrade] = await this.db.insert(trades).values(trade).returning();

    if (!createdTrade) {
      throw new Error("Failed to create trade");
    }

    return createdTrade;
  }
}
