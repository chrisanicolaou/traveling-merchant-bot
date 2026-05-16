import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandIntegerOption,
  SlashCommandStringOption,
  type SharedSlashCommand,
} from "discord.js";
import { BaseCommand } from "./command";
import { CommandName, CommandOptionName } from "../constants";
import { TradeDirection } from "../../shared/enums";
import { TradeNotFoundError } from "../../services/tradesService";
import type { Services } from "../../shared/types/services";
import type { TradeWithDetails } from "../../db/schema";

const AUTOCOMPLETE_NAME_MAX = 100;

export class RemoveCommand extends BaseCommand {
  data: SharedSlashCommand;

  constructor(services: Services) {
    super(services);
    this.data = new SlashCommandBuilder()
      .setName(CommandName.REMOVE)
      .setDescription("Remove one of your open buy/sell requests")
      .addStringOption(
        new SlashCommandStringOption()
          .setName(CommandOptionName.TRADE)
          .setDescription("The request to remove")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addIntegerOption(
        new SlashCommandIntegerOption()
          .setName(CommandOptionName.QUANTITY)
          .setDescription("How many copies to remove. Omit to remove the whole request.")
          .setMinValue(1)
          .setMaxValue(99),
      );
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const tradeId = interaction.options.getString(CommandOptionName.TRADE, true);
    const quantity = interaction.options.getInteger(CommandOptionName.QUANTITY) ?? undefined;

    try {
      const { removed, deleted } = await this.services.tradesService.removeTradeQuantity(
        tradeId,
        interaction.user.id,
        quantity,
      );

      const removedCount = deleted ? removed.quantity : (quantity ?? removed.quantity);
      const label = this.formatTradeLabel(removed, removedCount);
      const remaining = deleted ? "" : ` (${removed.quantity} still on your list.)`;

      await interaction.editReply(`Removed ${label}.${remaining}`);
    } catch (error) {
      if (error instanceof TradeNotFoundError) {
        await interaction.editReply(
          "That trade is no longer on your list — it may already have been removed.",
        );
        return;
      }
      console.error("Failed to remove trade", error);
      await interaction.editReply("Failed to remove trade. Check logs for details.");
    }
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== CommandOptionName.TRADE) {
      await interaction.respond([]);
      return;
    }

    const trades = await this.services.tradesService.getTradesByDiscordUserId(
      interaction.user.id,
    );
    trades.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const typed = focused.value.toLowerCase();
    const matches = trades
      .map((trade) => ({ trade, label: this.formatAutocompleteLabel(trade) }))
      .filter(({ label }) => label.toLowerCase().includes(typed))
      .slice(0, 25);

    await interaction.respond(
      matches.map(({ trade, label }) => ({
        name: truncate(label, AUTOCOMPLETE_NAME_MAX),
        value: trade.id,
      })),
    );
  }

  private formatAutocompleteLabel(trade: TradeWithDetails): string {
    const printing = trade.cardPrinting;
    const cardName = printing?.cardData?.name ?? "Unknown card";
    const setName = printing?.set?.name ?? "Unknown set";
    const setId = printing?.set?.id ?? "?";
    const traits = printing
      ? this.services.printingTraitsService.formatTraits(printing.traits)
      : "None";
    const dirTag = trade.direction === TradeDirection.Buy ? "[BUY]" : "[SELL]";
    return `${dirTag} ${cardName} (${traits}) ×${trade.quantity} — ${setName} (${setId})`;
  }

  private formatTradeLabel(trade: TradeWithDetails, count: number): string {
    const printing = trade.cardPrinting;
    const cardName = printing?.cardData?.name ?? "Unknown card";
    const setId = printing?.set?.id ?? "?";
    const traits = printing
      ? this.services.printingTraitsService.formatTraits(printing.traits)
      : "None";
    const dirTag = trade.direction === TradeDirection.Buy ? "BUY" : "SELL";
    return `**[${dirTag}] ${cardName} (${traits}) ×${count}** from set \`${setId}\``;
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + "…";
}
