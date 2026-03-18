import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const trades = pgTable("trades", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
});
