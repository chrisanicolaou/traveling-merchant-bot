import * as z from "zod";

export enum IndexType {
  Keywords = "keywords",
  CardNames = "card_names",
  CardTypes = "card_types",
  CardSupertypes = "card_supertypes",
  Domains = "domains",
  Rarities = "rarities",
  Artists = "artists",
  Tags = "tags",
}

export const RiftcodexIndexApiResponse = z.object({
  total: z.number(),
  type: z.enum(IndexType),
  values: z.array(z.string()),
});
export type RiftcodexIndexApiResponse = z.infer<typeof RiftcodexIndexApiResponse>;

export const RiftcodexSetsApiResponse = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      set_id: z.string(),
      card_count: z.number().nullable().optional(),
      tcgplayer_id: z.union([z.string(), z.number()]).nullable().optional(),
      published_on: z.string().nullable().optional(),
    }),
  ),
  total: z.number(),
  page: z.number(),
  size: z.number(),
  pages: z.number(),
});
export type RiftcodexSetsApiResponse = z.infer<typeof RiftcodexSetsApiResponse>;

export const RiftcodexCardsApiResponse = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      riftbound_id: z.string(),
      tcgplayer_id: z.union([z.string(), z.number()]).nullable().optional(),
      set: z.object({
        set_id: z.string(),
        label: z.string(),
      }),
      media: z
        .object({
          image_url: z.string().nullable().optional(),
          artist: z.string().nullable().optional(),
        })
        .partial()
        .default({}),
      metadata: z
        .object({
          alternate_art: z.boolean().optional(),
          overnumbered: z.boolean().optional(),
          signature: z.boolean().optional(),
          metal: z.boolean().optional(),
          starter: z.boolean().optional(),
          launch_exclusive: z.boolean().optional(),
          ggez: z.boolean().optional(),
          "271": z.boolean().optional(),
          "272": z.boolean().optional(),
          "273": z.boolean().optional(),
          "274": z.boolean().optional(),
        })
        .catchall(z.unknown())
        .default({}),
    }),
  ),
  total: z.number(),
  page: z.number(),
  size: z.number(),
  pages: z.number(),
});
export type RiftcodexCardsApiResponse = z.infer<typeof RiftcodexCardsApiResponse>;
