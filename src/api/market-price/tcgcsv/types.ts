import { z } from "zod";

export const TcgcsvCategoriesResponse = z.object({
  results: z.array(
    z.object({
      categoryId: z.number(),
      name: z.string(),
    }),
  ),
});
export type TcgcsvCategoriesResponse = z.infer<typeof TcgcsvCategoriesResponse>;

export const TcgcsvGroupsResponse = z.object({
  results: z.array(
    z.object({
      groupId: z.number(),
      name: z.string(),
    }),
  ),
});
export type TcgcsvGroupsResponse = z.infer<typeof TcgcsvGroupsResponse>;

export const TcgcsvPricesResponse = z.object({
  results: z.array(
    z.object({
      productId: z.number(),
      marketPrice: z.number().nullable().optional(),
      midPrice: z.number().nullable().optional(),
      lowPrice: z.number().nullable().optional(),
      highPrice: z.number().nullable().optional(),
      subTypeName: z.string().nullable().optional(),
    }),
  ),
});
export type TcgcsvPricesResponse = z.infer<typeof TcgcsvPricesResponse>;

export type SerializedPriceMap = Record<string, { marketPriceCents: number; fetchedAt: string }>;
