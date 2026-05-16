import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type SharedSlashCommand,
} from "discord.js";
import { BaseCommand } from "./command";
import { PrintingTraits, TradeDirection } from "../../shared/enums";
import type { Services } from "../../shared/types/services";
import { TradeQuantityExceededError } from "../../services/tradesService";
import type { ResolvedCardPrinting, TradeRow } from "../../db/schema";
import { parseCardList } from "./tradeBulk/parseCardList";
import {
  buildBulkReplyEmbed,
  type LineOutcome,
  type LineResult,
} from "./tradeBulk/buildBulkReplyEmbed";

export const MODAL_CUSTOM_ID_PREFIX = "tradebulk";
export const CARDS_INPUT_ID = "cards";

export abstract class TradeBulkCommand extends BaseCommand {
  data: SharedSlashCommand;
  protected abstract readonly direction: TradeDirection;
  protected abstract readonly modalCustomId: string;

  constructor(services: Services, name: string, description: string) {
    super(services);
    this.data = new SlashCommandBuilder().setName(name).setDescription(description);
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const verb = this.direction === TradeDirection.Buy ? "buy" : "sell";
    const modal = new ModalBuilder()
      .setCustomId(this.modalCustomId)
      .setTitle(`Bulk ${verb} list`);

    const input = new TextInputBuilder()
      .setCustomId(CARDS_INPUT_ID)
      .setLabel("Cards (one per line: `<qty> <card name>`)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("2 Arcane Shift\n2 Star-Crossed\n1 Rebuke")
      .setRequired(true)
      .setMaxLength(4000);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }

  async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const rawInput = interaction.fields.getTextInputValue(CARDS_INPUT_ID);
      const parsed = parseCardList(rawInput);

      if (parsed.length === 0) {
        await interaction.editReply("No card lines found. Format: `<quantity> <card name>` per line.");
        return;
      }

      const results: LineResult[] = [];
      const printingsToFetchCounterparts = new Map<string, ResolvedCardPrinting>();

      for (const line of parsed) {
        if (line.error !== undefined) {
          results.push({ line, outcome: { kind: "parse_error", reason: line.error } });
          continue;
        }

        const canonicalName = await this.services.cardsService.findCanonicalCardName(
          line.cardName,
        );
        if (!canonicalName) {
          results.push({ line, outcome: { kind: "unknown_card" } });
          continue;
        }

        const printing = await this.services.cardsService.getLatestPrintingByName(
          canonicalName,
          PrintingTraits.Standard,
        );
        if (!printing) {
          results.push({ line, outcome: { kind: "no_printing" } });
          continue;
        }

        try {
          const { row, previousQuantity } = await this.services.tradesService.upsertTrade({
            discordUserId: interaction.user.id,
            direction: this.direction,
            printingId: printing.id,
            quantity: line.quantity,
          });
          results.push({
            line,
            outcome: {
              kind: "added",
              printing,
              quantity: row.quantity,
              previousQuantity,
            },
          });
          printingsToFetchCounterparts.set(printing.id, printing);
        } catch (error) {
          if (error instanceof TradeQuantityExceededError) {
            results.push({
              line,
              outcome: {
                kind: "quantity_exceeded",
                existing: error.existingQuantity,
                attempted: error.attemptedDelta,
              },
            });
            continue;
          }
          console.error("Failed to upsert trade in bulk handler", error);
          results.push({ line, outcome: { kind: "internal_error" } });
        }
      }

      const counterpartTradesByPrintingId = await this.fetchCounterparts(
        [...printingsToFetchCounterparts.keys()],
      );

      const { embed, counterpartUserIds } = buildBulkReplyEmbed({
        direction: this.direction,
        results,
        counterpartTradesByPrintingId,
      });

      await interaction.editReply({
        embeds: [embed],
        allowedMentions: { users: counterpartUserIds },
      });
    } catch (error) {
      console.error("Failed to process bulk trade modal", error);
      await interaction.editReply("Failed to process list. Check logs for details.");
    }
  }

  private async fetchCounterparts(printingIds: string[]): Promise<Map<string, TradeRow[]>> {
    const entries = await Promise.all(
      printingIds.map(async (id) => {
        const trades = await this.services.tradesService.getOpenCounterpartTrades(
          id,
          this.direction,
        );
        return [id, trades] as const;
      }),
    );
    return new Map(entries);
  }
}
