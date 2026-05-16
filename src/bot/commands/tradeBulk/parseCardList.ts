export const MAX_BULK_LINES = 100;
export const MAX_QUANTITY_PER_LINE = 99;

export type ParseError = "malformed" | "quantity_out_of_range" | "over_line_limit";

export type ParsedLine =
  | { raw: string; quantity: number; cardName: string; error?: undefined }
  | { raw: string; error: ParseError };

const LINE_PATTERN = /^(\d+)\s+(.+?)$/;

export function parseCardList(input: string): ParsedLine[] {
  const rawLines = input.split(/\r?\n/);
  const out: ParsedLine[] = [];

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;

    if (out.length >= MAX_BULK_LINES) {
      out.push({ raw: trimmed, error: "over_line_limit" });
      continue;
    }

    const match = trimmed.match(LINE_PATTERN);
    if (!match) {
      out.push({ raw: trimmed, error: "malformed" });
      continue;
    }

    const quantity = Number.parseInt(match[1]!, 10);
    const cardName = match[2]!.trim();

    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) {
      out.push({ raw: trimmed, error: "quantity_out_of_range" });
      continue;
    }
    if (cardName.length === 0) {
      out.push({ raw: trimmed, error: "malformed" });
      continue;
    }

    out.push({ raw: trimmed, quantity, cardName });
  }

  return out;
}
