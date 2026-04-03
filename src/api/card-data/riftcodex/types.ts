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
export type RiftcodexIndexApiResponse = z.infer<
  typeof RiftcodexIndexApiResponse
>;
