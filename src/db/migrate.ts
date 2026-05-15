import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { CONFIG_KEY, ConfigService } from "../services/configService.ts";

async function main() {
  const config = new ConfigService();
  config.initializeConfig();

  const connectionString = `postgres://${config.get(CONFIG_KEY.POSTGRES_USER)}:${config.get(
    CONFIG_KEY.POSTGRES_PASSWORD,
  )}@${config.get(CONFIG_KEY.POSTGRES_HOST)}:${config.get(CONFIG_KEY.POSTGRES_PORT)}/${config.get(
    CONFIG_KEY.POSTGRES_DB,
  )}`;

  const pool = new Pool({ connectionString });
  const retryDelayMs = 2_000;
  const maxRetries = 15;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query("select 1");
      break;
    } catch (error) {
      if (attempt === maxRetries) {
        await pool.end().catch(() => undefined);
        throw new Error(`Unable to connect to PostgreSQL after ${maxRetries} attempts`, {
          cause: error,
        });
      }
      console.warn("Waiting for PostgreSQL connection before migrating...");
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  const db = drizzle({ client: pool });
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
