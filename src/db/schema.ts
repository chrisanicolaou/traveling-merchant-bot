import {
  boolean,
  customType,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { PrintingTraits, type TradeDirection } from "../shared/enums";
import { type BuildQueryResult, defineRelations, sql } from "drizzle-orm";

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

export const trades = pgTable(
  "trades",
  {
    id: uuid().defaultRandom().primaryKey(),
    printingId: uuid()
      .notNull()
      .references(() => cardPrintings.id),
    discordUserId: varchar({ length: 255 }).notNull(),
    direction: tradeDirection().notNull(), // 0 for buy, 1 for sell
    quantity: integer().notNull().default(1),
    ...timestamps,
  },
  (t) => [
    unique("trades_user_direction_printing_unique").on(
      t.discordUserId,
      t.direction,
      t.printingId,
    ),
  ],
);
export type NewTradeRow = Omit<typeof trades.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type TradeRow = typeof trades.$inferSelect;

export const cardDatas = pgTable("card_datas", {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar({ length: 255 }).notNull().unique(),
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

export const relations = defineRelations({ cardDatas, cardPrintings, sets, trades }, (r) => ({
  cardDatas: {
    printings: r.many.cardPrintings({
      from: r.cardDatas.id,
      to: r.cardPrintings.cardId,
    }),
  },
  cardPrintings: {
    cardData: r.one.cardDatas({
      from: r.cardPrintings.cardId,
      to: r.cardDatas.id,
    }),
    set: r.one.sets({
      from: r.cardPrintings.setId,
      to: r.sets.id,
    }),
    trades: r.many.trades({
      from: r.cardPrintings.id,
      to: r.trades.printingId,
    }),
  },
  sets: {
    cardPrintings: r.many.cardPrintings({
      from: r.sets.id,
      to: r.cardPrintings.setId,
    }),
  },
  trades: {
    cardPrinting: r.one.cardPrintings({
      from: r.trades.printingId,
      to: r.cardPrintings.id,
    }),
  },
}));

export type CardPrintingWithCardData = BuildQueryResult<
  typeof relations,
  (typeof relations)["cardPrintings"],
  {
    with: {
      cardData: true;
    };
  }
>;

export type CardPrintingWithCardDataAndSet = BuildQueryResult<
  typeof relations,
  (typeof relations)["cardPrintings"],
  {
    with: {
      cardData: true;
      set: true;
    };
  }
>;

export type ResolvedCardPrinting = Omit<CardPrintingWithCardDataAndSet, "cardData" | "set"> & {
  cardData: NonNullable<CardPrintingWithCardDataAndSet["cardData"]>;
  set: NonNullable<CardPrintingWithCardDataAndSet["set"]>;
};

export type CardDataWithPrintings = BuildQueryResult<
  typeof relations,
  (typeof relations)["cardDatas"],
  {
    with: {
      printings: true;
    };
  }
>;

export type TradeWithCardPrinting = BuildQueryResult<
  typeof relations,
  (typeof relations)["trades"],
  {
    with: {
      cardPrinting: true;
    };
  }
>;

export type TradeWithDetails = BuildQueryResult<
  typeof relations,
  (typeof relations)["trades"],
  {
    with: {
      cardPrinting: {
        with: {
          cardData: true;
          set: true;
        };
      };
    };
  }
>;
