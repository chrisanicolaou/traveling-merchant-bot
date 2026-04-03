import dotenv from "dotenv";

export class ConfigService {
  initializeConfig() {
    const nodeEnv = process.env.NODE_ENV;
    let envFile: string;

    switch (nodeEnv) {
      case "production":
        envFile = ".env.production";
        break;
      case "local":
        envFile = ".env.local";
        break;
      default:
        console.warn("Value of NODE_ENV is not recognised; defaulting to local config");
        envFile = ".env.local";
    }

    dotenv.config({ path: envFile });
  }

  get(key: CONFIG_KEY): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required config value: ${key}`);
    }
    return value;
  }
}

export enum CONFIG_KEY {
  RIOT_API_KEY = "RIOT_API_KEY",
  DISCORD_APP_ID = "DISCORD_APP_ID",
  DISCORD_PUBLIC_KEY = "DISCORD_PUBLIC_KEY",
  DISCORD_APP_TOKEN = "DISCORD_APP_TOKEN",
  DISCORD_GUILD_ID = "DISCORD_GUILD_ID",
  POSTGRES_USER = "POSTGRES_USER",
  POSTGRES_PASSWORD = "POSTGRES_PASSWORD",
  POSTGRES_DB = "POSTGRES_DB",
  POSTGRES_HOST = "POSTGRES_HOST",
  POSTGRES_PORT = "POSTGRES_PORT",
  REDIS_HOST = "REDIS_HOST",
  REDIS_PORT = "REDIS_PORT",
  CARD_DATA_PROVIDER = "CARD_DATA_PROVIDER",
  DISCORD_GUILD_ADMIN_ROLE_ID = "DISCORD_GUILD_ADMIN_ROLE_ID",
  EVENTS_PROVIDER = "EVENTS_PROVIDER",
  EVENTS_LATITUDE = "EVENTS_LATITUDE",
  EVENTS_LONGITUDE = "EVENTS_LONGITUDE",
  EVENTS_RADIUS_KM = "EVENTS_RADIUS_KM",
}
