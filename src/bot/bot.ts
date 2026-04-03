import { Client, GatewayIntentBits, Events } from "discord.js";
import { CommandLoader } from "./commandLoader";
import type { Command } from "./commands/command";
import { CONFIG_KEY, type ConfigService } from "../services/configService";
import type { Services } from "../shared/types/services";

export class Bot {
  private client: Client;

  constructor(private readonly services: Services) {
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] });
  }

  async run() {
    const commandLoader = new CommandLoader(this.services);
    await commandLoader.loadCommands(this.client);

    this.client.once(Events.ClientReady, () => {
      console.log(`Logged in as ${this.client.user?.tag}`);
    });

    // TODO: refactor handlers into individual classes. register and iterate through them all (how does TS handle IoC?)
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isChatInputCommand()) {
        try {
          const command = this.getCommandHandler(interaction.commandName);
          await command.execute(interaction);
        } catch (error) {
          console.error(error);
        }
      } else if (interaction.isAutocomplete()) {
        try {
          const command = this.getCommandHandler(interaction.commandName);
          if (!command.autocomplete) {
            console.error(
              `No autocomplete handler found for command ${interaction.commandName}`,
            );
            return;
          }
          await command.autocomplete(interaction);
        } catch (error) {
          console.error(error);
        }
      }
    });

    await this.client.login(
      this.services.config.get(CONFIG_KEY.DISCORD_APP_TOKEN),
    );
  }

  private getCommandHandler(name: string): Command {
    const command = this.client.commands.get(name);

    if (!command) {
      throw new Error(`No command matching ${name} was found.`);
    }

    return command;
  }
}
