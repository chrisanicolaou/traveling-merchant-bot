import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Interaction,
  SharedSlashCommand,
  SlashCommandBuilder,
} from "discord.js";
import type { Services } from "../../shared/types/services";

export interface Command {
  data: SharedSlashCommand;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

export abstract class BaseCommand implements Command {
  abstract data: SharedSlashCommand;
  abstract execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;

  constructor(protected readonly services: Services) {}
}
