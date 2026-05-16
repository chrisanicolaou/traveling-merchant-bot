import { Collection, REST, Routes, type Client } from "discord.js";
import path from "node:path";
import { readdir } from "node:fs/promises";
import type { BaseCommand, Command } from "./commands/command";
import { fileURLToPath } from "node:url";
import { CONFIG_KEY } from "../services/configService";
import type { Services } from "../shared/types/services";
import { BuyCommand } from "./commands/buyCommand";
import { SellCommand } from "./commands/sellCommand";
import { RemoveCommand } from "./commands/removeCommand";
import { SyncCardDataCommand } from "./commands/syncCardDataCommand";
import { SyncEventsCommand } from "./commands/syncEventsCommand";

export class CommandLoader {
  constructor(private readonly services: Services) {}

  async loadCommands(client: Client): Promise<void> {
    const commands: Command[] = [
      new BuyCommand(this.services),
      new SellCommand(this.services),
      new RemoveCommand(this.services),
      new SyncCardDataCommand(this.services),
      new SyncEventsCommand(this.services),
    ];

    client.commands = new Collection();
    for (const command of commands) {
      client.commands.set(command.data.name, command);
    }

    const rest = new REST({ version: "10" }).setToken(
      this.services.config.get(CONFIG_KEY.DISCORD_APP_TOKEN),
    );
    (async () => {
      try {
        console.log(`Started refreshing ${client.commands.size} application (/) commands.`);
        const data = await rest.put(
          Routes.applicationGuildCommands(
            this.services.config.get(CONFIG_KEY.DISCORD_APP_ID),
            this.services.config.get(CONFIG_KEY.DISCORD_GUILD_ID),
          ),
          { body: client.commands.map((command) => command.data.toJSON()) },
        );
        console.log(
          `Successfully reloaded ${(data as unknown[]).length} application (/) commands.`,
        );
      } catch (error) {
        console.error(error);
      }
    })();

    // const filename = fileURLToPath(import.meta.url);
    // const dirname = path.dirname(filename);
    // const foldersPath = path.join(dirname, "commands");
    // const commandFolders = await readdir(foldersPath);

    // for (const folder of commandFolders) {
    //   const commandsPath = path.join(foldersPath, folder);
    //   const commandFiles = await readdir(commandsPath);
    //   const filteredFiles = commandFiles.filter((file) => file.endsWith(".ts"));
    //   for (const file of filteredFiles) {
    //     const filePath = path.join(commandsPath, file);
    //     const mod = await import(filePath);
    //     const command = mod.default as Command;
    //     // Set a new item in the Collection with the key as the command name and the value as the exported module
    // if ("data" in command && "execute" in command) {
    //   client.commands.set(command.data.name, command);
    // } else {
    //   console.warn(
    //     `The command at ${filePath} is missing a required "data" or "execute" property.`,
    //   );
    //     }
    //   }
  }
}
