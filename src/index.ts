import { Bot } from "./bot/bot.ts";
import { CacheService } from "./services/cacheService.ts";
import { CONFIG_KEY, ConfigService } from "./services/configService.ts";
import type { Services } from "./shared/types/services.ts";
import { CardsService } from "./services/cardsService.ts";
import { PrintingTraitsService } from "./services/printingTraitsService.ts";
import { RiftcodexProvider } from "./api/card-data/riftcodex/riftcodexProvider.ts";
import { DbConnection } from "./db/dbConnection.ts";
import { TradesService } from "./services/tradesService.ts";
import { RiftfoundProvider } from "./api/events/riftfound/riftfoundProvider.ts";
import { EventsService } from "./services/eventsService.ts";
import type { MarketPriceProvider } from "./api/market-price/marketPriceProvider.ts";
import { TcgcsvProvider } from "./api/market-price/tcgcsv/tcgcsvProvider.ts";
import { FrankfurterProvider } from "./api/exchange-rate/frankfurter/frankfurterProvider.ts";

async function main() {
  const { services, dbConnection } = await initializeServices();
  const bot = new Bot(services);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down`);
    try {
      await bot.shutdown();
      await services.cache.shutdown();
      await dbConnection.close();
    } catch (err) {
      console.error("Error during shutdown:", err);
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  await bot.run();
}

async function initializeServices(): Promise<{ services: Services; dbConnection: DbConnection }> {
  const config = new ConfigService();
  config.initializeConfig();
  const cache = await CacheService.create(config);
  const dbConnection = await DbConnection.createAsync(config);
  const printingTraitsService = new PrintingTraitsService();
  const cardsService = new CardsService(
    cache,
    loadCardDataProvider(config),
    printingTraitsService,
    dbConnection.db,
  );
  const tradesService = new TradesService(dbConnection.db);
  const eventsService = new EventsService(loadEventsProvider(config), config);
  const marketPriceProvider = loadMarketPriceProvider(config, cache);
  const exchangeRateProvider = new FrankfurterProvider({ cache });

  return {
    services: {
      config,
      cache,
      cardsService,
      printingTraitsService,
      tradesService,
      eventsService,
      marketPriceProvider,
      exchangeRateProvider,
    },
    dbConnection,
  };
}

function loadCardDataProvider(config: ConfigService) {
  switch (config.get(CONFIG_KEY.CARD_DATA_PROVIDER)) {
    case "riftcodex": {
      return new RiftcodexProvider();
    }
    default:
      throw new Error(`Invalid ${CONFIG_KEY.CARD_DATA_PROVIDER} specified`);
  }
}

function loadEventsProvider(config: ConfigService) {
  switch (config.get(CONFIG_KEY.EVENTS_PROVIDER)) {
    case "riftfound": {
      return new RiftfoundProvider();
    }
    default:
      throw new Error(`Invalid ${CONFIG_KEY.EVENTS_PROVIDER} specified`);
  }
}

function loadMarketPriceProvider(config: ConfigService, cache: CacheService): MarketPriceProvider {
  switch (config.get(CONFIG_KEY.MARKET_PRICE_PROVIDER)) {
    case "tcgcsv": {
      const categoryOverride = config.getOptional(CONFIG_KEY.TCGCSV_CATEGORY_ID);
      return new TcgcsvProvider({
        cache,
        categoryIdOverride: categoryOverride ? Number(categoryOverride) : undefined,
      });
    }
    default:
      throw new Error(`Invalid ${CONFIG_KEY.MARKET_PRICE_PROVIDER} specified`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
