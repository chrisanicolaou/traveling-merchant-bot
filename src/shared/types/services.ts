import type { CacheService } from "../../services/cacheService";
import type { CardsService } from "../../services/cardsService";
import type { ConfigService } from "../../services/configService";
import type { EventsService } from "../../services/eventsService";
import type { PrintingTraitsService } from "../../services/printingTraitsService";
import type { TradesService } from "../../services/tradesService";

export type Services = {
  config: ConfigService;
  cache: CacheService;
  cardsService: CardsService;
  printingTraitsService: PrintingTraitsService;
  tradesService: TradesService;
  eventsService: EventsService;
};
