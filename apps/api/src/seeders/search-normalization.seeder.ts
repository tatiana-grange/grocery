import { EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { applySearchNormalization } from '../modules/db/search.util'

/**
 * Creates `normalize_search` and nothing else.
 *
 * `schema:fresh` builds the schema from entity metadata and never replays the migrations, so
 * the function every search box calls would be missing and the list endpoints would 500. The
 * seeders that load data already call `applySearchNormalization` themselves; this one exists so
 * `db:fresh`, which loads no data at all, can still ask for it through `--seed`.
 */
export class SearchNormalizationSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await applySearchNormalization(em)
  }
}
