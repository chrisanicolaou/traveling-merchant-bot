import { Client, GatewayIntentBits, Events } from "discord.js";
import { loadCommands } from "./commandLoader";

export class Bot {
  private client: Client;

  constructor() {
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] });
  }

  async run() {
    await loadCommands();

    this.client.once(Events.ClientReady, () => {
      console.log(`Logged in as ${this.client.user?.tag}`);
    });

    // TODO: refactor handlers into individual classes. register and iterate through them all (how does TS handle IoC?)
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      if (interaction.commandName === "hello") {
        await interaction.reply("Hello world!");
      }
    });

    await this.client.login(process.env.DISCORD_APP_TOKEN);
  }

  async shutdown() {
    await this.client.destroy();
  }
}
