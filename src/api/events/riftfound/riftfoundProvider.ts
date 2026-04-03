import { ApiClient } from "../../apiClient";
import type { EventsProvider } from "../eventsProvider";
import type { ApiRiftboundEvent } from "../types";

export class RiftfoundProvider implements EventsProvider {
  private client: ApiClient;
  constructor() {
    this.client = new ApiClient("https://www.riftfound.com/api");
  }

  async getEvents(
    latitude: number,
    longitude: number,
    radiusKm: number,
    startDate: Date = new Date(),
    endDate: Date = this.addOneMonth(startDate), // default to one month from startDate
  ): Promise<ApiRiftboundEvent[]> {
    const params = new URLSearchParams({
      calendarMode: "true",
      startDateFrom: startDate.toISOString(),
      startDateTo: endDate.toISOString(),
      lat: latitude.toString(),
      lng: longitude.toString(),
      radiusKm: radiusKm.toString(),
    });
    const response = await this.client.get("/events", params);
    const json = (await response.json()) as any; // TODO - create domain object for Riftfound API response
    return json.data.map((event: any): ApiRiftboundEvent => {
      return {
        name: event.name,
        id: event.externalId,
        description: event.description,
        url: `https://www.riftfound.com/api/events/${event.id}/visit`,
        address: event.address,
        startDate: new Date(event.startDate),
        organizer: event.organizer,
      };
    });
  }

  private addOneMonth(date: Date): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1);
    return result;
  }
}
