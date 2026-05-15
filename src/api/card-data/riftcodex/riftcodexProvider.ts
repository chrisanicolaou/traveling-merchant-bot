import { ApiClient } from "../../apiClient";
import { PrintingTraits } from "../../../shared/enums";
import type {
  CardDataProvider,
  CardDataSyncCard,
  CardDataSyncPage,
  CardDataSyncPageRequest,
  CardDataSyncSet,
} from "../cardDataProvider";
import {
  RiftcodexCardsApiResponse,
  RiftcodexIndexApiResponse,
  RiftcodexSetsApiResponse,
  type RiftcodexCardsApiResponse as RiftcodexCardsApiResponseType,
  type RiftcodexSetsApiResponse as RiftcodexSetsApiResponseType,
} from "./types";

export class RiftcodexProvider implements CardDataProvider {
  private client: ApiClient;
  constructor() {
    this.client = new ApiClient("https://api.riftcodex.com");
  }

  // Deprecated: card-name autocomplete now sources from the DB. Kept to satisfy interface.
  async getCardNames(): Promise<string[]> {
    const response = await this.client.get("/index/card-names");
    const json = await this.parseJsonResponse(response);
    const parsedResponse = await RiftcodexIndexApiResponse.parseAsync(json);
    return parsedResponse.values;
  }

  async getSets(): Promise<CardDataSyncSet[]> {
    const sets: CardDataSyncSet[] = [];
    for (let page = 1; ; page++) {
      const response = await this.client.get(
        "/sets",
        new URLSearchParams({ size: "100", page: page.toString() }),
      );
      const json = await this.parseJsonResponse(response);
      const parsed = await RiftcodexSetsApiResponse.parseAsync(json);

      sets.push(...parsed.items.map(mapSetForSync));

      if (parsed.items.length === 0 || parsed.page >= parsed.pages) break;
    }
    return sets;
  }

  // TODO - create domain object for card data. Decide what I actually want from underlying APIs
  async getCardByName(cardName: string): Promise<any> {
    return Promise.resolve();
  }

  async getCardsPage(params: CardDataSyncPageRequest): Promise<CardDataSyncPage> {
    const response = await this.client.get(
      "/cards",
      new URLSearchParams({
        size: params.take.toString(),
        sort: params.sort,
        page: params.page.toString(),
      }),
    );
    const json = await this.parseJsonResponse(response);
    const parsedResponse = await RiftcodexCardsApiResponse.parseAsync(json);

    return {
      items: parsedResponse.items.map(mapCardForSync),
      total: parsedResponse.total,
      page: parsedResponse.page,
      size: parsedResponse.size,
      pages: parsedResponse.pages,
    };
  }

  private async parseJsonResponse(response: Response): Promise<unknown> {
    if (!response.ok) {
      throw new Error(`Riftcodex request failed with status ${response.status}`);
    }

    return response.json();
  }
}

function mapSetForSync(
  set: RiftcodexSetsApiResponseType["items"][number],
): CardDataSyncSet {
  return {
    id: set.set_id,
    name: set.name,
    riftcodexId: set.id,
    tcgPlayerId: set.tcgplayer_id != null ? String(set.tcgplayer_id) : null,
    cardCount: set.card_count ?? null,
    releaseDate: set.published_on ? new Date(set.published_on) : null,
  };
}

function mapCardForSync(card: RiftcodexCardsApiResponseType["items"][number]): CardDataSyncCard {
  return {
    name: card.name,
    riftcodexId: card.id,
    riftboundId: card.riftbound_id,
    tcgplayerId: toNullableNumber(card.tcgplayer_id),
    imageUrl: card.media.image_url ?? null,
    artist: card.media.artist ?? null,
    traits: getPrintingTraits(card.metadata),
    setId: card.set.set_id,
  };
}

function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function getPrintingTraits(metadata: RiftcodexCardsApiResponseType["items"][number]["metadata"]) {
  let traits = PrintingTraits.None;

  const traitFlags: Array<[keyof typeof metadata, PrintingTraits]> = [
    ["alternate_art", PrintingTraits.AlternateArt],
    ["overnumbered", PrintingTraits.Overnumbered],
    ["signature", PrintingTraits.Signature],
    ["metal", PrintingTraits.Metal],
    ["starter", PrintingTraits.Starter],
    ["launch_exclusive", PrintingTraits.LaunchExclusive],
    ["ggez", PrintingTraits.GGEZ],
    ["271", PrintingTraits._271],
    ["272", PrintingTraits._272],
    ["273", PrintingTraits._273],
    ["274", PrintingTraits._274],
  ];

  for (const [flag, printingTrait] of traitFlags) {
    if (metadata[flag] === true) {
      traits |= printingTrait;
    }
  }

  // Riftcodex has no explicit "standard" flag — absence of all special-printing flags
  // is treated as a Standard printing by convention.
  return traits === PrintingTraits.None ? PrintingTraits.Standard : traits;
}
