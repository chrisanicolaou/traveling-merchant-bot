import type { EventsProvider } from "../api/events/eventsProvider";
import type { ApiRiftboundEvent } from "../api/events/types";
import { CONFIG_KEY, type ConfigService } from "./configService";

export class EventsService {
  constructor(
    private readonly eventsProvider: EventsProvider,
    private readonly config: ConfigService,
  ) {}

  async getEvents(): Promise<ApiRiftboundEvent[]> {
    const latitude = parseFloat(this.config.get(CONFIG_KEY.EVENTS_LATITUDE));
    const longitude = parseFloat(this.config.get(CONFIG_KEY.EVENTS_LONGITUDE));
    const radiusKm = parseFloat(this.config.get(CONFIG_KEY.EVENTS_RADIUS_KM));

    const events = await this.eventsProvider.getEvents(latitude, longitude, radiusKm);

    return events;
  }
}
