import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

const nodeEnv = process.env.NODE_ENV;
if (nodeEnv === "local") {
  loadEnv({ path: ".env.local" });
} else if (nodeEnv === "production") {
  loadEnv({ path: ".env" });
}

const databaseUrl =
  process.env.DATABASE_URL ??
  `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;

export default defineConfig({
  out: "./src/db/migrations",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: databaseUrl,
  },
});
