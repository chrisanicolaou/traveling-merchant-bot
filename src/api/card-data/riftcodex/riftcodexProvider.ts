import { ApiClient } from "../../apiClient";
import type { CardDataProvider } from "../cardDataProvider";
import { RiftcodexIndexApiResponse } from "./types";

export class RiftcodexProvider implements CardDataProvider {
  private client: ApiClient;
  constructor() {
    this.client = new ApiClient("https://api.riftcodex.com");
  }

  async getCardNames(): Promise<string[]> {
    const response = await this.client.get("/index/card-names");
    const json = await response.json();
    const parsedResponse = await RiftcodexIndexApiResponse.parseAsync(json);
    return parsedResponse.values;
  }

  // TODO - create domain object for card data. Decide what I actually want from underlying APIs
  async getCardByName(cardName: string): Promise<any> {
    return Promise.resolve();
  }
}
