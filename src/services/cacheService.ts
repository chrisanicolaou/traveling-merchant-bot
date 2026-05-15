import { createClient } from "redis";
import { CONFIG_KEY, type ConfigService } from "./configService";

export class CacheService {
  private constructor(private readonly client: ReturnType<typeof createClient>) {}

  static async create(config: ConfigService): Promise<CacheService> {
    const host = config.get(CONFIG_KEY.REDIS_HOST);
    const port = config.get(CONFIG_KEY.REDIS_PORT);

    const client = createClient({
      url: `redis://${host}:${port}`,
    });

    await connectWithRetry(client, host, port);

    return new CacheService(client);
  }

  async get<T = string>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number) {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (ttlSeconds === undefined) {
      await this.client.set(key, serialized);
    } else {
      await this.client.set(key, serialized, { EX: ttlSeconds });
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, "1", { NX: true, EX: ttlSeconds });
    return result === "OK";
  }

  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }

  async shutdown() {
    await this.client.quit();
  }
}

async function connectWithRetry(
  client: ReturnType<typeof createClient>,
  host: string,
  port: string,
): Promise<void> {
  const maxAttempts = 10;
  const delayMs = 1_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await client.connect();
      console.log(`Connected to Redis at ${host}:${port}`);
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw new Error(
          `Failed to connect to Redis at ${host}:${port} after ${maxAttempts} attempts`,
          { cause: error },
        );
      }

      console.warn(
        `Redis not ready at ${host}:${port} (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms...`,
      );

      await sleep(delayMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
