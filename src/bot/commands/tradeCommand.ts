import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  type SharedSlashCommand,
} from "discord.js";
import { BaseCommand } from "./command";
import { CommandOptionName } from "../constants";
import {
  cardNameOption,
  printingTraitsOption,
  quantityOption,
  setOption,
} from "../commandOptions";
import { PrintingTraits, TradeDirection } from "../../shared/enums";
import type { Services } from "../../shared/types/services";
import type { ResolvedCardPrinting, TradeRow } from "../../db/schema";
import type { MarketPrice } from "../../api/market-price/marketPriceProvider";

const DISPLAY_CURRENCY = "GBP";

type DisplayPrice = { gbpCents: number; fetchedAt: Date };

export abstract class TradeCommand extends BaseCommand {
  data: SharedSlashCommand;
  protected abstract readonly direction: TradeDirection;

  constructor(services: Services, name: string, description: string) {
    super(services);
    this.data = new SlashCommandBuilder()
      .setName(name)
      .setDescription(description)
      .addStringOption(cardNameOption())
      .addStringOption(setOption())
      .addIntegerOption(printingTraitsOption())
      .addIntegerOption(quantityOption());
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const cardName = interaction.options.getString(CommandOptionName.CARDNAME, true);
      const setId = interaction.options.getString(CommandOptionName.SET, true);
      const traits =
        interaction.options.getInteger(CommandOptionName.PRINTINGTRAITS) ??
        PrintingTraits.Standard;
      const quantity = interaction.options.getInteger(CommandOptionName.QUANTITY) ?? 1;

      const printing = await this.services.cardsService.getPrintingByNameTraitsAndSet(
        cardName,
        traits,
        setId,
      );
      if (!printing) {
        await interaction.editReply(
          `No matching printing for **${cardName}** in set \`${setId}\` with the chosen printing traits. Try a different set or refine the printing traits.`,
        );
        return;
      }

      await this.services.tradesService.createTrade({
        discordUserId: interaction.user.id,
        direction: this.direction,
        printingId: printing.id,
        quantity,
      });

      const [price, counterparts] = await Promise.all([
        this.fetchPriceSafe(printing.tcgplayerId),
        this.services.tradesService.getOpenCounterpartTrades(printing.id, this.direction),
      ]);
      const displayPrice = await this.convertToDisplayCurrencySafe(price);

      const embed = this.buildReplyEmbed(printing, quantity, displayPrice, counterparts);
      const counterpartIds = [...new Set(counterparts.map((t) => t.discordUserId))];

      await interaction.editReply({
        embeds: [embed],
        allowedMentions: { users: counterpartIds },
      });
    } catch (error) {
      console.error(`Failed to register ${this.directionLabel().toLowerCase()} trade`, error);
      await interaction.editReply("Failed to register trade. Check logs for details.");
    }
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused(true);
    switch (focused.name) {
      case CommandOptionName.CARDNAME:
        return this.handleCardNameAutocomplete(interaction);
      case CommandOptionName.SET:
        return this.handleSetAutocomplete(interaction);
      case CommandOptionName.PRINTINGTRAITS:
        return this.handlePrintingTraitsAutocomplete(interaction);
    }
  }

  private async handleCardNameAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const cards = await this.services.cardsService.getCardNames();
    const typed = interaction.options.getFocused().toLowerCase();
    const filtered = cards.filter((card) => card.toLowerCase().includes(typed));
    await interaction.respond(filtered.slice(0, 25).map((card) => ({ name: card, value: card })));
  }

  private async handleSetAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const cardName = interaction.options.getString(CommandOptionName.CARDNAME);
    if (!cardName) {
      await interaction.respond([]);
      return;
    }
    const sets = await this.services.cardsService.getSetsForCardName(cardName);
    const typed = interaction.options.getFocused().toLowerCase();
    const filtered = sets.filter(
      (s) => s.name.toLowerCase().includes(typed) || s.id.toLowerCase().includes(typed),
    );
    await interaction.respond(
      filtered.slice(0, 25).map((s) => ({ name: `${s.name} (${s.id})`, value: s.id })),
    );
  }

  private async handlePrintingTraitsAutocomplete(
    interaction: AutocompleteInteraction,
  ): Promise<void> {
    const cardName = interaction.options.getString(CommandOptionName.CARDNAME);
    if (!cardName) {
      await interaction.respond([]);
      return;
    }
    const availableTraits =
      await this.services.cardsService.getPrintingOptionsFromCardName(cardName);
    const choices = this.services.printingTraitsService.getChoices(availableTraits);
    await interaction.respond(choices.slice(0, 25));
  }

  private async fetchPriceSafe(tcgplayerId: number | null): Promise<MarketPrice | null> {
    if (tcgplayerId === null) return null;
    try {
      return await this.services.marketPriceProvider.getPriceByTcgplayerId(tcgplayerId);
    } catch (error) {
      console.warn("Market price lookup failed", error);
      return null;
    }
  }

  private async convertToDisplayCurrencySafe(
    price: MarketPrice | null,
  ): Promise<DisplayPrice | null> {
    if (!price) return null;
    if (price.currency === DISPLAY_CURRENCY) {
      return { gbpCents: price.marketPriceCents, fetchedAt: price.fetchedAt };
    }
    try {
      const rate = await this.services.exchangeRateProvider.getRate(
        price.currency,
        DISPLAY_CURRENCY,
      );
      return {
        gbpCents: Math.round(price.marketPriceCents * rate),
        fetchedAt: price.fetchedAt,
      };
    } catch (error) {
      console.warn("Exchange rate lookup failed", error);
      return null;
    }
  }

  private buildReplyEmbed(
    printing: ResolvedCardPrinting,
    quantity: number,
    price: DisplayPrice | null,
    counterparts: TradeRow[],
  ): EmbedBuilder {
    const isBuy = this.direction === TradeDirection.Buy;
    const title = `${this.directionLabel()} listed: ${printing.cardData.name}`;
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(isBuy ? 0x2ecc71 : 0xe74c3c)
      .setFooter({ text: "Prices are estimates only." });

    if (printing.imageUrl) embed.setThumbnail(printing.imageUrl);

    const traitsLabel = this.services.printingTraitsService.formatTraits(printing.traits);
    embed.addFields(
      { name: "Set", value: `${printing.set.name} (${printing.set.id})`, inline: true },
      { name: "Traits", value: traitsLabel, inline: true },
      { name: "Quantity", value: String(quantity), inline: true },
      { name: "Market price", value: formatDisplayPrice(price, printing.cardData.name) },
      {
        name: isBuy ? "Selling this card" : "Looking to buy this card",
        value: formatCounterparts(counterparts),
      },
    );
    return embed;
  }

  private directionLabel(): string {
    return this.direction === TradeDirection.Buy ? "Buy" : "Sell";
  }
}

function buildCardmarketUrl(cardName: string): string {
  const slug = cardName
    .replace(/[^A-Za-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return `https://www.cardmarket.com/en/Riftbound/Cards/${slug}`;
}

function formatDisplayPrice(price: DisplayPrice | null, cardName: string): string {
  const url = buildCardmarketUrl(cardName);
  if (!price) return `[Not available](${url})`;
  const pounds = (price.gbpCents / 100).toFixed(2);
  const dateLabel = price.fetchedAt.toISOString().slice(0, 10);
  return `[£${pounds} (${dateLabel})](${url})`;
}

function formatCounterparts(trades: TradeRow[]): string {
  if (trades.length === 0) return "No one yet — check back later.";
  const totals = new Map<string, number>();
  for (const trade of trades) {
    totals.set(trade.discordUserId, (totals.get(trade.discordUserId) ?? 0) + trade.quantity);
  }
  return [...totals.entries()]
    .map(([id, qty]) => `<@${id}> — ${qty} ${qty === 1 ? "copy" : "copies"}`)
    .join("\n");
}
