import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const commands = [
  new SlashCommandBuilder()
    .setName("hello")
    .setDescription("Say hello!")
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_APP_TOKEN!,
);

export async function loadCommands() {
  console.log("token set:", !!process.env.DISCORD_APP_TOKEN);
  console.log("app id set:", !!process.env.DISCORD_APP_ID);
  try {
    console.log("Registering commands...");
    await rest.put(Routes.applicationCommands(process.env.DISCORD_APP_ID!), {
      body: commands,
    });
    console.log("Commands registered!");
  } catch (error) {
    console.error(error);
  }
}
