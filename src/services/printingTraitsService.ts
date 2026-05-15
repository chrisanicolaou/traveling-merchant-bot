import { PrintingTraits } from "../shared/enums";

type PrintingTraitChoice = {
  name: string;
  value: number;
};

export class PrintingTraitsService {
  private readonly printingTraitNameMap: Record<string, PrintingTraits> = {
    "alternate art": PrintingTraits.AlternateArt,
    overnumbered: PrintingTraits.Overnumbered,
    signature: PrintingTraits.Signature,
    metal: PrintingTraits.Metal,
    starter: PrintingTraits.Starter,
    "launch exclusive": PrintingTraits.LaunchExclusive,
    ggez: PrintingTraits.GGEZ,
    "271": PrintingTraits._271,
    "272": PrintingTraits._272,
    "273": PrintingTraits._273,
    "274": PrintingTraits._274,
  };

  toPrintingTrait(printingName: string): PrintingTraits {
    return this.printingTraitNameMap[printingName.toLowerCase()] ?? PrintingTraits.None;
  }

  formatTraits(traits: PrintingTraits): string {
    if (traits === PrintingTraits.None) return "None";
    const names = getPrintingTraitEntries()
      .filter(([, value]) => value !== PrintingTraits.None && (traits & value) === value)
      .map(([name]) => name);
    return names.length > 0 ? names.join(", ") : "Unknown";
  }

  getChoices(printingTraits: PrintingTraits): PrintingTraitChoice[] {
    const choices = getPrintingTraitEntries()
      .filter(([, value]) => value !== PrintingTraits.None && (printingTraits & value) === value)
      .map(([name, value]) => ({
        name,
        value,
      }));

    if (hasMultiplePrintingTraits(printingTraits)) {
      return [{ name: "Any", value: printingTraits }, ...choices];
    }

    return choices;
  }
}

function getPrintingTraitEntries(): Array<[string, PrintingTraits]> {
  return Object.entries(PrintingTraits).filter(
    (entry): entry is [string, PrintingTraits] =>
      Number.isNaN(Number(entry[0])) && typeof entry[1] === "number",
  );
}

function hasMultiplePrintingTraits(printingTraits: PrintingTraits): boolean {
  return printingTraits !== PrintingTraits.None && (printingTraits & (printingTraits - 1)) !== 0;
}
