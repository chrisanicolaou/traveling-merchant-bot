import type { CardDataProvider } from "../api/card-data/cardDataProvider";
import { PrintingTraits } from "../shared/enums";
import { CacheService } from "./cacheService";
import { PrintingTraitsService } from "./printingTraitsService";

export class CardsService {
  private readonly CARD_NAMES_WITH_PRINTINGS_CACHE_KEY = "full_card_names";
  private readonly CARD_NAMES_CACHE_KEY = "card_names";

  constructor(
    private readonly cacheService: CacheService,
    private readonly cardDataProvider: CardDataProvider,
    private readonly printingTraitsService: PrintingTraitsService,
  ) {}

  async getCardNamesWithPrintings(): Promise<string[]> {
    const cached = await this.cacheService.get<string[]>(this.CARD_NAMES_WITH_PRINTINGS_CACHE_KEY);
    if (cached) {
      console.log("Cache hit for card names with printings");
      return cached;
    }

    console.log("Cache miss for card names with printings. Fetching from provider...");
    return this.getAndCacheFullCardNames();
  }

  async getCardNames(): Promise<string[]> {
    const cached = await this.cacheService.get<string[]>(this.CARD_NAMES_CACHE_KEY);
    if (cached) {
      console.log("Cache hit for card names");
      return cached;
    }

    console.log("Cache miss for card names. Checking full card names cache...");

    const fullCardsCached = await this.cacheService.get<string[]>(
      this.CARD_NAMES_WITH_PRINTINGS_CACHE_KEY,
    );
    if (fullCardsCached) {
      console.log("Cache hit for full card names. Extracting card names to cache...");
      return this.extractAndCacheCardNames(fullCardsCached);
    }

    console.log("Cache miss for full card names. Fetching from provider...");
    const fullCardNames = await this.getAndCacheFullCardNames();
    return this.extractAndCacheCardNames(fullCardNames);
  }

  async getPrintingOptionsFromCardName(cardName: string): Promise<PrintingTraits> {
    const fullCardNames = await this.getCardNamesWithPrintings();
    return fullCardNames.reduce<PrintingTraits>((printingTraits, fullName) => {
      if (fullName === cardName) {
        return printingTraits | PrintingTraits.Standard;
      }

      if (!fullName.startsWith(`${cardName} (`)) {
        return printingTraits;
      }

      const printingName = fullName.slice(fullName.indexOf(" (") + 2, fullName.lastIndexOf(")"));
      return printingTraits | this.printingTraitsService.toPrintingTrait(printingName);
    }, PrintingTraits.None);
  }

  private async getAndCacheFullCardNames(): Promise<string[]> {
    const cardNames = await this.cardDataProvider.getCardNames();
    await this.cacheService.set(this.CARD_NAMES_WITH_PRINTINGS_CACHE_KEY, cardNames);
    return cardNames;
  }

  private extractAndCacheCardNames(fullCardNames: string[]): string[] {
    const cardNames = Array.from(new Set(fullCardNames.map((card) => card.split(" (")[0]!)));
    this.cacheService.set(this.CARD_NAMES_CACHE_KEY, cardNames);
    return cardNames;
  }
}
