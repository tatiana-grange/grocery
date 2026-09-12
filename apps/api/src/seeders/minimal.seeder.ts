import { EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { createUserData } from '../modules/auth/auth.factory'
import { applySearchNormalization } from '../modules/db/search.util'

/**
 * MinimalSeeder creates just a single verified user for quick testing.
 */
export class MinimalSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await applySearchNormalization(em)
    await createUserData(em, {
      name: 'Test User',
      email: 'test@grocery.example',
      emailVerified: true,
    })
  }
}
