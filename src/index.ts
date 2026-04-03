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

async function main() {
  const services = await initializeServices();
  const bot = new Bot(services);

  await bot.run();
}

async function initializeServices(): Promise<Services> {
  const config = new ConfigService();
  config.initializeConfig();
  const cache = await CacheService.create(config);
  const dbConnection = await DbConnection.createAsync(config);
  const printingTraitsService = new PrintingTraitsService();
  const cardsService = new CardsService(cache, loadCardDataProvider(config), printingTraitsService);
  const tradesService = new TradesService(dbConnection.db);
  const eventsService = new EventsService(loadEventsProvider(config), config);

  return { config, cache, cardsService, printingTraitsService, tradesService, eventsService };
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

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
