import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { CommandName, CommandOptionName } from "../constants";
import { cardNameOption, printingTraitsOption, quantityOption } from "../commandOptions";
import { BaseCommand } from "./command";
import type { CardsService } from "../../services/cardsService";
import type { Services } from "../../shared/types/services";
import type { PrintingTraitsService } from "../../services/printingTraitsService";
import { PrintingTraits, TradeDirection } from "../../shared/enums";
import type { TradeRow, NewTradeRow } from "../../db/schema";
import type { TradesService } from "../../services/tradesService";

export class BuyCommand extends BaseCommand {
  cardsService: CardsService;
  printingTraitsService: PrintingTraitsService;
  tradesService: TradesService;
  data = new SlashCommandBuilder()
    .setName(CommandName.BUY)
    .setDescription("Add a card you'd like to buy")
    .addStringOption(cardNameOption)
    .addIntegerOption(quantityOption)
    .addIntegerOption(printingTraitsOption);

  constructor(protected readonly services: Services) {
    super(services);
    this.cardsService = services.cardsService;
    this.printingTraitsService = services.printingTraitsService;
    this.tradesService = services.tradesService;
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const cardName = interaction.options.getString(CommandOptionName.CARDNAME, true);
    const quantity = interaction.options.getInteger(CommandOptionName.QUANTITY) ?? 1;
    const printingTraitsValue: PrintingTraits =
      interaction.options.getInteger(CommandOptionName.PRINTINGTRAITS) ?? PrintingTraits.Standard;
    const tradeToCreate: NewTradeRow = {
      discordUserId: interaction.user.id,
      direction: TradeDirection.Buy,
      printingId: "TODO",
      quantity,
    };
    this.tradesService.createTrade(tradeToCreate);
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused(true);
    switch (focused.name) {
      case CommandOptionName.CARDNAME:
        await this.handleCardNameAutocomplete(interaction);
        break;
      case CommandOptionName.PRINTINGTRAITS:
        await this.handlePrintingTraitsAutocomplete(interaction);
        break;
    }
  }

  private async handleCardNameAutocomplete(interaction: AutocompleteInteraction) {
    const cards = await this.cardsService.getCardNames();
    const filtered = cards.filter((card) =>
      card.toLowerCase().includes(interaction.options.getFocused().toLowerCase()),
    );
    await interaction.respond(filtered.map((card) => ({ name: card, value: card })).slice(0, 25));
  }

  private async handlePrintingTraitsAutocomplete(interaction: AutocompleteInteraction) {
    const cardName = interaction.options.getString(CommandOptionName.CARDNAME);
    if (!cardName) {
      await interaction.respond([]);
      return;
    }
    const availablePrintingTraits =
      await this.cardsService.getPrintingOptionsFromCardName(cardName);
    const printingChoices = this.printingTraitsService.getChoices(availablePrintingTraits);
    await interaction.respond(printingChoices.slice(0, 25));
  }
}

//   new SlashCommandBuilder()
//     .setName(CommandName.SELL)
//     .setDescription("test")
//     .addStringOption(
//       new SlashCommandStringOption()
//         .setName("list")
//         .setDescription("test")
//         .setRequired(true),
//     )
//     .toJSON(),
