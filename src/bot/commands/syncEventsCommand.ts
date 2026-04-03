import {
  GuildMemberRoleManager,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Services } from "../../shared/types/services";
import { BaseCommand } from "./command";
import { CommandName } from "../constants";
import { CONFIG_KEY } from "../../services/configService";
import type { ApiRiftboundEvent } from "../../api/events/types";

export class SyncEventsCommand extends BaseCommand {
  adminRoleId?: string;
  data = new SlashCommandBuilder()
    .setName(CommandName.SYNC_EVENTS)
    .setDescription("Sync upcoming local events");

  constructor(protected readonly services: Services) {
    super(services);
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    this.adminRoleId =
      this.adminRoleId ?? this.services.config.get(CONFIG_KEY.DISCORD_GUILD_ADMIN_ROLE_ID);
    const userRoles = (interaction.member?.roles as GuildMemberRoleManager)?.cache;

    if (!userRoles?.has(this.adminRoleId)) {
      await interaction.reply("You do not have permission to use this command.");
      return;
    }

    const events: ApiRiftboundEvent[] = await this.services.eventsService.getEvents();
    const existingEvents = await interaction.guild?.scheduledEvents.fetch();
    let skippedEventsCount = 0;
    let syncedEventsCount = 0;

    for (const event of events) {
      if (existingEvents?.some((e) => e.name === event.name)) {
        skippedEventsCount++;
        continue;
      }
      const scheduledEndTime = new Date(event.startDate);
      scheduledEndTime.setHours(scheduledEndTime.getHours() + 6);

      await interaction.guild?.scheduledEvents.create({
        name: event.name,
        scheduledStartTime: event.startDate,
        scheduledEndTime,
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType: GuildScheduledEventEntityType.External,
        entityMetadata: {
          location: event.address,
        },
        description: event.url,
      });
      syncedEventsCount++;
    }

    await interaction.editReply(
      `Synced ${syncedEventsCount} events. Skipped ${skippedEventsCount} events (already existed).`,
    );
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
