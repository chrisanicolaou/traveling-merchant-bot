import * as z from "zod";

export const ApiRiftboundEvent = z.object({
  name: z.string(),
  id: z.string(),
  description: z.string(),
  address: z.string(),
  startDate: z.date(),
  organizer: z.string(),
  url: z.url(),
});
export type ApiRiftboundEvent = z.infer<typeof ApiRiftboundEvent>;
