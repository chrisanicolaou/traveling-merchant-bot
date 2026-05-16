import { EmbedBuilder } from "discord.js";
import { TradeDirection } from "../../../shared/enums";
import type { ResolvedCardPrinting, TradeRow } from "../../../db/schema";
import type { ParsedLine } from "./parseCardList";

export type LineOutcome =
  | { kind: "added"; printing: ResolvedCardPrinting; quantity: number; previousQuantity: number | null }
  | { kind: "parse_error"; reason: string }
  | { kind: "unknown_card" }
  | { kind: "no_printing" }
  | { kind: "quantity_exceeded"; existing: number; attempted: number }
  | { kind: "internal_error" };

export type LineResult = {
  line: ParsedLine;
  outcome: LineOutcome;
};

const MAX_BODY_CHARS = 3800;
const MAX_COUNTERPART_USERS = 25;

export function buildBulkReplyEmbed(args: {
  direction: TradeDirection;
  results: LineResult[];
  counterpartTradesByPrintingId: Map<string, TradeRow[]>;
}): { embed: EmbedBuilder; counterpartUserIds: string[] } {
  const { direction, results, counterpartTradesByPrintingId } = args;
  const isBuy = direction === TradeDirection.Buy;
  const verb = isBuy ? "Buy" : "Sell";

  let addedLines = 0;
  let addedCopies = 0;
  let skippedLines = 0;
  const statusLines: string[] = [];
  let truncatedCount = 0;
  let bodyLength = 0;

  for (const result of results) {
    const status = formatLineStatus(result);
    if (result.outcome.kind === "added") {
      addedLines++;
      addedCopies += result.outcome.quantity;
    } else {
      skippedLines++;
    }

    if (bodyLength + status.length + 1 > MAX_BODY_CHARS) {
      truncatedCount++;
      continue;
    }
    statusLines.push(status);
    bodyLength += status.length + 1;
  }

  if (truncatedCount > 0) {
    statusLines.push(`... +${truncatedCount} more lines (reply too long)`);
  }

  const counterpartFieldValue = buildCounterpartsValue(
    results,
    counterpartTradesByPrintingId,
    isBuy,
  );

  const embed = new EmbedBuilder()
    .setTitle(`${verb} list updated`)
    .setColor(isBuy ? 0x2ecc71 : 0xe74c3c)
    .setDescription(statusLines.join("\n") || "No lines processed.")
    .addFields({
      name: "Summary",
      value: `Added: ${addedLines} ${addedLines === 1 ? "line" : "lines"} (${addedCopies} ${addedCopies === 1 ? "copy" : "copies"}) · Skipped: ${skippedLines}`,
    })
    .addFields({
      name: isBuy ? "Selling these cards" : "Looking to buy these cards",
      value: counterpartFieldValue.text,
    })
    .setFooter({
      text: "Use /buy or /sell on a single card to see market price.",
    });

  return { embed, counterpartUserIds: counterpartFieldValue.userIds };
}

function formatLineStatus(result: LineResult): string {
  const { line, outcome } = result;

  if (line.error !== undefined) {
    const reason = parseErrorReason(line.error);
    return `✗ \`${truncate(line.raw, 60)}\` — ${reason}`;
  }

  const label = `${line.quantity}× ${line.cardName}`;

  switch (outcome.kind) {
    case "added": {
      const { printing, quantity, previousQuantity } = outcome;
      const setLabel = `${printing.set.id}`;
      const qtyLabel =
        previousQuantity === null ? "added" : `was ${previousQuantity}, now ${quantity}`;
      return `✓ ${label} (${setLabel}) — ${qtyLabel}`;
    }
    case "unknown_card":
      return `✗ ${label} — card not found`;
    case "no_printing":
      return `✗ ${label} — no Standard printing found`;
    case "quantity_exceeded":
      return `✗ ${label} — would exceed 99-copy limit (have ${outcome.existing})`;
    case "internal_error":
      return `✗ ${label} — internal error`;
    case "parse_error":
      return `✗ \`${truncate(line.raw, 60)}\` — ${outcome.reason}`;
  }
}

function parseErrorReason(error: NonNullable<ParsedLine["error"]>): string {
  switch (error) {
    case "malformed":
      return "malformed (expected `<qty> <card name>`)";
    case "quantity_out_of_range":
      return "quantity must be 1–99";
    case "over_line_limit":
      return "over 100-line limit";
  }
}

function buildCounterpartsValue(
  results: LineResult[],
  counterpartTradesByPrintingId: Map<string, TradeRow[]>,
  _isBuy: boolean,
): { text: string; userIds: string[] } {
  const userToCards = new Map<string, Map<string, number>>();

  for (const result of results) {
    if (result.outcome.kind !== "added") continue;
    const printing = result.outcome.printing;
    const counterparts = counterpartTradesByPrintingId.get(printing.id) ?? [];
    for (const trade of counterparts) {
      let cardMap = userToCards.get(trade.discordUserId);
      if (!cardMap) {
        cardMap = new Map();
        userToCards.set(trade.discordUserId, cardMap);
      }
      const prev = cardMap.get(printing.cardData.name) ?? 0;
      cardMap.set(printing.cardData.name, prev + trade.quantity);
    }
  }

  if (userToCards.size === 0) {
    return { text: "No matches — check back later.", userIds: [] };
  }

  const allUserIds = [...userToCards.keys()];
  const limited = allUserIds.slice(0, MAX_COUNTERPART_USERS);
  const overflow = allUserIds.length - limited.length;

  const lines = limited.map((userId) => {
    const cardMap = userToCards.get(userId)!;
    const cardsLabel = [...cardMap.entries()]
      .map(([name, qty]) => `${name} ×${qty}`)
      .join(", ");
    return `<@${userId}> — ${cardsLabel}`;
  });
  if (overflow > 0) lines.push(`... +${overflow} more`);

  return { text: lines.join("\n"), userIds: limited };
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
