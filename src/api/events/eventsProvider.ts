import type { ApiRiftboundEvent } from "./types";

export interface EventsProvider {
  getEvents(
    latitude: number,
    longitude: number,
    radiusKm: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ApiRiftboundEvent[]>;
}
