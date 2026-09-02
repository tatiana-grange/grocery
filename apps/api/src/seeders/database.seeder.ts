/* oxlint-disable no-console */

import { Dictionary, EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { AuthSeeder } from '../modules/auth/auth.seeder'
import { CatalogSeeder } from '../modules/catalog/catalog.seeder'
import { MembersSeeder } from '../modules/members/members.seeder'

export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const context: Dictionary = {}

    await new AuthSeeder().run(em, context)
    console.info('AuthSeeder done')

    await new MembersSeeder().run(em, context)
    console.info('MembersSeeder done')

    await new CatalogSeeder().run(em, context)
    console.info('CatalogSeeder done')
  }
}
