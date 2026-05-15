import {
  GuildMemberRoleManager,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { CONFIG_KEY } from "../../services/configService";
import type { Services } from "../../shared/types/services";
import {
  SYNC_CARDS_LOCK_KEY,
  SYNC_CARDS_LOCK_TTL_SECONDS,
  type SyncAllCardsResult,
  type SyncProgress,
} from "../../services/cardsService";
import { CommandName } from "../constants";
import { BaseCommand } from "./command";

const PROGRESS_INTERVAL_MS = 30_000;

export class SyncCardDataCommand extends BaseCommand {
  private adminRoleId?: string;

  data = new SlashCommandBuilder()
    .setName(CommandName.SYNC_CARD_DATA)
    .setDescription("Sync card data from the configured provider");

  constructor(protected readonly services: Services) {
    super(services);
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!this.userIsAdmin(interaction)) {
      await interaction.reply("You do not have permission to use this command.");
      return;
    }

    const acquired = await this.services.cache.acquireLock(
      SYNC_CARDS_LOCK_KEY,
      SYNC_CARDS_LOCK_TTL_SECONDS,
    );
    if (!acquired) {
      await interaction.reply(
        "A card data sync is already running. Try again once it completes.",
      );
      return;
    }

    await interaction.deferReply();
    await interaction.editReply("Syncing card data. This may take a while...");

    try {
      const startedAt = Date.now();
      let lastEditAt = 0;

      const syncResult = await this.services.cardsService.syncAllCards((snapshot) => {
        const now = Date.now();
        if (now - lastEditAt < PROGRESS_INTERVAL_MS) return;
        lastEditAt = now;
        interaction
          .editReply(formatProgress(snapshot))
          .catch((err) => console.warn("Progress edit failed", err));
      });
      const durationSeconds = ((Date.now() - startedAt) / 1_000).toFixed(1);

      await interaction.editReply(formatSyncResult(syncResult, durationSeconds));
    } catch (error) {
      console.error("Failed to sync card data", error);
      await interaction.editReply("Failed to sync card data. Check logs for details.");
    } finally {
      await this.services.cache.releaseLock(SYNC_CARDS_LOCK_KEY);
    }
  }

  private userIsAdmin(interaction: ChatInputCommandInteraction): boolean {
    this.adminRoleId ??= this.services.config.get(CONFIG_KEY.DISCORD_GUILD_ADMIN_ROLE_ID);
    const userRoles = (interaction.member?.roles as GuildMemberRoleManager | undefined)?.cache;

    return userRoles?.has(this.adminRoleId) ?? false;
  }
}

function formatProgress(snapshot: SyncProgress): string {
  return [
    `Syncing card data... page ${snapshot.currentPage}/${snapshot.totalPages}`,
    `Processed ${snapshot.cardsProcessed} cards.`,
    `Sets: ${snapshot.setsInserted} new / ${snapshot.setsUpdated} updated.`,
    `Printings: ${snapshot.cardPrintingsInserted} new / ${snapshot.cardPrintingsUpdated} updated.`,
  ].join(" ");
}

function formatSyncResult(syncResult: SyncAllCardsResult, durationSeconds: string): string {
  return [
    `Card sync complete in ${durationSeconds}s.`,
    `Processed ${syncResult.cardsProcessed} cards across ${syncResult.pagesProcessed} pages.`,
    `Inserted ${syncResult.setsInserted} sets and updated ${syncResult.setsUpdated} sets.`,
    `Inserted ${syncResult.cardDatasInserted} card records.`,
    `Inserted ${syncResult.cardPrintingsInserted} printings and updated ${syncResult.cardPrintingsUpdated} printings.`,
  ].join(" ");
}
