import {
  boolean,
  customType,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { PrintingTraits, type TradeDirection } from "../shared/enums";
import { defineRelations, sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
};

const tradeDirection = customType<{ data: TradeDirection; driverData: number }>({
  dataType() {
    return "smallint";
  },
});

const printingTraits = customType<{
  data: PrintingTraits;
  driverData: number;
}>({
  dataType() {
    return "smallint";
  },
});

export const trades = pgTable("trades", {
  id: uuid().defaultRandom().primaryKey(),
  printingId: uuid()
    .notNull()
    .references(() => cardPrintings.id),
  discordUserId: varchar({ length: 255 }).notNull(),
  direction: tradeDirection().notNull(), // 0 for buy, 1 for sell
  quantity: integer().notNull().default(1),
  ...timestamps,
});
export type NewTradeRow = Omit<typeof trades.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type TradeRow = typeof trades.$inferSelect;

export const cardDatas = pgTable("card_datas", {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  ...timestamps,
});
export type NewCardDataRow = Omit<typeof cardDatas.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type CardDataRow = typeof cardDatas.$inferSelect;

export const sets = pgTable("sets", {
  id: varchar({ length: 15 }).primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  riftcodexId: varchar({ length: 32 }),
  tcgPlayerId: varchar({ length: 15 }),
  cardCount: smallint(),
  releaseDate: timestamp(),
  ...timestamps,
});
export type NewSetRow = Omit<typeof sets.$inferInsert, "createdAt" | "updatedAt">;
export type SetRow = typeof sets.$inferSelect;

export const cardPrintings = pgTable("card_printings", {
  id: uuid().defaultRandom().primaryKey(),
  cardId: uuid()
    .notNull()
    .references(() => cardDatas.id),
  setId: varchar({ length: 15 })
    .notNull()
    .references(() => sets.id),
  riftboundId: varchar({ length: 32 }),
  riftcodexId: varchar({ length: 32 }),
  tcgplayerId: integer(),
  imageUrl: varchar({ length: 2047 }),
  artist: varchar({ length: 255 }),
  traits: printingTraits().notNull().default(PrintingTraits.None),
  ...timestamps,
});
export type NewCardPrintingRow = Omit<
  typeof cardPrintings.$inferInsert,
  "id" | "createdAt" | "updatedAt"
>;
export type CardPrintingRow = typeof cardPrintings.$inferSelect;

export const relations = defineRelations({ cardDatas, cardPrintings, sets, trades }, (r) => ({}));
