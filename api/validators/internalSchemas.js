import { z } from "zod";

export const settlementRunsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .passthrough();
