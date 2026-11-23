// TEST CONTAINER MANAGER
//
// Utilities for creating one database per test.
// Each database is cloned from a template, so tests stay isolated and cheap.

import { MikroORM } from '@mikro-orm/core'
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy'
import { Client } from 'pg'
import { createTestMikroOrmOptions } from '../../modules/db/db.config'
import { applySearchNormalization } from '../../modules/db/search.util'

export interface TestOrmContext {
  orm: MikroORM
  mikroOrmOptions: ReturnType<typeof createTestMikroOrmOptions>
}

interface TestDbConfig {
  host: string
  port: number
  user: string
  password: string
}

const TEMPLATE_DB = 'test_template'
/** Held while the template is built and while a database is cloned from it. */
const TEMPLATE_LOCK_ID = 7_342_001

/**
 * Creates a fresh, empty database for one test and initializes MikroORM on it.
 *
 * Building the schema is the slow part, so it is done once: the first caller builds a template
 * database, and every test then clones it with `CREATE DATABASE … TEMPLATE`. Test files run in
 * parallel workers, so building and cloning happen under a Postgres advisory lock.
 * @returns TestOrmContext with ORM and MikroORM options
 */
export async function createTestOrm(dbConfig: TestDbConfig): Promise<TestOrmContext> {
  // @ts-expect-error - import.meta is not available in CommonJS BUT DUDE I KNOW WHAT I'M DOING
  // This file is used by Vitest and we need to use the ESM import.meta.glob to get the entities.
  const entityModules = import.meta.glob('../../modules/**/*.entity.ts', { eager: true })

  const allEntities = Array.from(
    new Set(
      Object.values(entityModules).flatMap((mod) =>
        Object.values(mod as object).filter((val) => typeof val === 'function'),
      ),
    ),
  )

  const optionsFor = (dbName: string) =>
    createTestMikroOrmOptions({
      entitiesTs: allEntities,
      allowGlobalContext: true,
      contextName: `context_${dbName}`,
      dbName,
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      preferTs: true,
      metadataProvider: ReflectMetadataProvider,
    })

  const dbName = `test_${crypto.randomUUID()}`
  process.env.DATABASE_NAME = dbName

  await cloneTemplateDatabase(dbConfig, dbName, async () => {
    // Built under another name and renamed at the end, so a crash never leaves a half-built
    // template behind.
    const buildName = `${TEMPLATE_DB}_building`
    const builder = await MikroORM.init(optionsFor(buildName))
    try {
      await builder.schema.refresh()
      await applySearchNormalization(builder.em)
    } finally {
      await builder.close(true)
    }
    return buildName
  })

  const mikroOrmOptions = optionsFor(dbName)
  const orm = await MikroORM.init(mikroOrmOptions)

  return {
    orm,
    mikroOrmOptions,
  }
}

async function cloneTemplateDatabase(
  dbConfig: TestDbConfig,
  dbName: string,
  buildTemplate: () => Promise<string>,
): Promise<void> {
  const admin = new Client({ ...dbConfig, database: 'postgres' })
  await admin.connect()
  try {
    await admin.query('SELECT pg_advisory_lock($1)', [TEMPLATE_LOCK_ID])
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEMPLATE_DB])
    if (exists.rowCount === 0) {
      await admin.query(`DROP DATABASE IF EXISTS "${TEMPLATE_DB}_building"`)
      const buildName = await buildTemplate()
      await admin.query(`ALTER DATABASE "${buildName}" RENAME TO "${TEMPLATE_DB}"`)
    }
    await admin.query(`CREATE DATABASE "${dbName}" TEMPLATE "${TEMPLATE_DB}"`)
  } finally {
    // Closing the connection also releases the advisory lock.
    await admin.end()
  }
}

/**
 * Cleans up an ORM
 * @param orm The ORM instance to cleanup
 */
export async function cleanupTestOrm(orm: MikroORM): Promise<void> {
  try {
    await orm.close(true)
  } catch (error) {
    console.error('Error during container cleanup:', error)
    // Continue cleanup even if there are errors
  }
}

/**
 * Resets the ORM schema. `schema.refresh()` builds the tables from entity metadata and knows
 * nothing about the `normalize_search` function the migrations install, so create it by hand —
 * otherwise the list endpoints fail the moment a test filters on `q`.
 */
export async function resetOrmSchema(orm: MikroORM): Promise<void> {
  await orm.schema.refresh()
  await applySearchNormalization(orm.em)
}
