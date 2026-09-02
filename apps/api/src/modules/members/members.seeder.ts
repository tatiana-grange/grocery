import { Dictionary, EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { createMemberData } from './members.factory'

/**
 * Seeds one administrator so a fresh database is usable: an auth user with `role: admin`,
 * an active `Member` row, and a membership-fee row.
 *
 * Credentials: admin@example.com / admin12345
 */
export class MembersSeeder extends Seeder {
  async run(em: EntityManager, context: Dictionary): Promise<void> {
    const { user, member } = await createMemberData(em, {
      user: { name: 'Cooperative Admin', email: 'admin@example.com', emailVerified: true },
      password: 'admin12345',
      roles: ['member', 'admin'],
      status: 'active',
    })

    context.adminUser = user
    context.adminMember = member
  }
}
