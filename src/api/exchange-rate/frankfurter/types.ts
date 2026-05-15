import { z } from "zod";

export const FrankfurterRateResponse = z.object({
  base: z.string(),
  quote: z.string(),
  rate: z.number(),
  date: z.string().optional(),
});
export type FrankfurterRateResponse = z.infer<typeof FrankfurterRateResponse>;
