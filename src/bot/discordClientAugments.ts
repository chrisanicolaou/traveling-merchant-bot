import { Client, Collection } from "discord.js";
import type { Command } from "./commands/command";

declare module "discord.js" {
  export interface Client {
    commands: Collection<string, Command>; // TODO - type this properly. I want a collection of command name to command data (options, handler, etc)
  }
}
