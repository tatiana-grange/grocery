import { z } from 'zod'

export const testSeedResetResponseSchema = z
  .object({
    ok: z.literal(true),
    reseeded: z.boolean(),
    truncatedTables: z.number().int().nonnegative(),
  })
  .meta({
    title: 'TestSeedResetResponse',
    description: 'Result of truncating the E2E database and re-running the E2E seeder',
  })

export type TestSeedResetResponse = z.infer<typeof testSeedResetResponseSchema>
