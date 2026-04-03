import {
  AutocompleteInteraction,
  REST,
  Routes,
  SlashCommandBuilder,
  SlashCommandIntegerOption,
  SlashCommandStringOption,
} from "discord.js";
import { CommandName, CommandOptionName } from "./constants";
import { Foil } from "../shared/enums";

export const cardNameOption = new SlashCommandStringOption()
  .setName(CommandOptionName.CARDNAME)
  .setDescription("The name of the card you'd like to buy/sell")
  .setRequired(true)
  .setAutocomplete(true);

export const quantityOption = new SlashCommandIntegerOption()
  .setName(CommandOptionName.QUANTITY)
  .setDescription("The amount of this card you'd like to buy/sell. Defaults to 1")
  .setMinValue(1)
  .setMaxValue(99);

export const foilOption = new SlashCommandIntegerOption()
  .setName(CommandOptionName.FOIL)
  .setDescription("Foil? Defaults to 'any'.")
  .addChoices(
    {
      name: "No foil",
      value: Foil.NoFoil,
    },
    {
      name: "Foil only",
      value: Foil.Foil,
    },
    {
      name: "Any",
      value: Foil.Any,
    },
  );

export const printingTraitsOption = new SlashCommandIntegerOption()
  .setName(CommandOptionName.PRINTINGTRAITS)
  .setDescription("The printing(s) you're looking for. Defaults to 'Standard'.")
  .setAutocomplete(true);

// export const overnumberOption = new SlashCommandIntegerOption()
//   .setName(CommandOptionName.OVERNUMBER)
//   .setDescription('Overnumbered? Defaults to "any".')
//   .addChoices(
//     {
//       name: "Not overnumbered",
//       value: Overnumbered.No,
//     },
//     {
//       name: "Overnumbered",
//       value: Overnumbered.Yes,
//     },
//     {
//       name: "Any",
//       value: Overnumbered.Any,
//     },
//   );

const commands = [
  new SlashCommandBuilder()
    .setName(CommandName.BUY)
    .setDescription("Add a card you'd like to buy")
    .addStringOption(cardNameOption)
    .toJSON(),
  new SlashCommandBuilder()
    .setName(CommandName.SELL)
    .setDescription("test")
    .addStringOption(
      new SlashCommandStringOption().setName("list").setDescription("test").setRequired(true),
    )
    .toJSON(),
];
