import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { CONFIG_KEY, type ConfigService } from "../services/configService";

export class DbConnection {
  private constructor(public readonly db: ReturnType<typeof drizzle>) {}

  static async createAsync(config: ConfigService): Promise<DbConnection> {
    const host = config.get(CONFIG_KEY.POSTGRES_HOST);
    const port = config.get(CONFIG_KEY.POSTGRES_PORT);
    const user = config.get(CONFIG_KEY.POSTGRES_USER);
    const password = config.get(CONFIG_KEY.POSTGRES_PASSWORD);
    const database = config.get(CONFIG_KEY.POSTGRES_DB);
    const connectionString = `postgres://${user}:${password}@${host}:${port}/${database}`;
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

        console.warn("Waiting for PostgreSQL connection...", error);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    const db = drizzle(pool, {
      casing: "snake_case",
    });

    return new DbConnection(db);
  }
}
