import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type SharedSlashCommand,
} from "discord.js";
import { BaseCommand } from "./command";
import { CommandName } from "../constants";
import type { Services } from "../../shared/types/services";

export class HelpCommand extends BaseCommand {
  data: SharedSlashCommand;

  constructor(services: Services) {
    super(services);
    this.data = new SlashCommandBuilder()
      .setName(CommandName.HELP)
      .setDescription("List available commands");
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const commands = Array.from(interaction.client.commands.values()).sort((a, b) =>
      a.data.name.localeCompare(b.data.name),
    );

    const description = commands
      .map((cmd) => `\`/${cmd.data.name}\` — ${cmd.data.description}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("Available commands")
      .setDescription(description);

    await interaction.editReply({ embeds: [embed] });
  }
}
