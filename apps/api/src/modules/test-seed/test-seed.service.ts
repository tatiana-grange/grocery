import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { E2eSeeder } from '../../seeders/e2e.seeder'
import { TestSeedResetResponse } from './test-seed.contract'

/**
 * Tables a reset never truncates: MikroORM bookkeeping, and the Better Auth tables. Keeping
 * `user` / `account` / `session` / `verification` means a saved Playwright `storageState`
 * stays valid across a reset — specs that call `resetDb` don't have to re-authenticate.
 * `E2eSeeder` dedupes users by email (`createUserData`), so re-running it against preserved
 * auth rows recreates only the domain data.
 */
const PRESERVED_TABLES = new Set([
  'mikro_orm_migrations',
  'user',
  'account',
  'session',
  'verification',
])

@Injectable()
export class TestSeedService {
  private readonly logger = new Logger(TestSeedService.name)

  constructor(private readonly em: EntityManager) {}

  /**
   * `TRUNCATE ... RESTART IDENTITY CASCADE` every public table, then re-run `E2eSeeder`.
   * Called from a Playwright `beforeEach` so each spec starts from the same committed
   * baseline — transaction rollback is impossible here, the API is a separate process the
   * browser talks to over HTTP.
   */
  async reset(): Promise<TestSeedResetResponse> {
    const em = this.em.fork()
    const connection = em.getConnection()

    const rows: { tablename: string }[] = await connection.execute(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    )
    const tables = rows
      .map((row): string => row.tablename)
      .filter((name: string) => !PRESERVED_TABLES.has(name))

    if (tables.length > 0) {
      const quoted = tables.map((name) => `"${name}"`).join(', ')
      await connection.execute(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`)
    }

    await new E2eSeeder().run(em)
    this.logger.log(`E2E database reset: truncated ${tables.length} tables and reseeded`)

    return { ok: true, reseeded: true, truncatedTables: tables.length }
  }
}
