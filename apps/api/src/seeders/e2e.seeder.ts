import { EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import {
  createCategoryData,
  createProductData,
  createSupplierData,
} from '../modules/catalog/catalog.factory'
import { MembershipPayment } from '../modules/members/entities/membership-payment.entity'
import { createMemberData } from '../modules/members/members.factory'

/**
 * The users the web-spa E2E suite (`apps/web-spa-e2e`) signs in as. Every account shares
 * `E2E_PASSWORD`. `auth.setup.ts` logs `admin` and `member` in once and saves their session.
 */
export const E2E_USERS = {
  admin: { email: 'admin@e2e.local', name: 'Ada Admin' },
  member: { email: 'member@e2e.local', name: 'Milo Member' },
  pending: { email: 'pending@e2e.local', name: 'Perry Pending' },
  banned: { email: 'banned@e2e.local', name: 'Ben Banned' },
  /** Active member the résiliation journey signs in as and terminates (revokes its sessions). */
  resign: { email: 'resign@e2e.local', name: 'Rosa Resign' },
  /** Active member the password-change journey signs in as (that flow rotates the session). */
  pwtest: { email: 'pwtest@e2e.local', name: 'Percy Password' },
} as const

export const E2E_PASSWORD = 'Password123!'

/** A seeded active member whose name the members-list search spec looks for. */
export const E2E_SEARCH_MEMBER_NAME = 'Zelda Searchable'

/** First names for the extra members that fill the paginated list (page size is 20). */
const FILLER_FIRST_NAMES = [
  'Alice',
  'Bruno',
  'Carla',
  'David',
  'Elsa',
  'Femi',
  'Gaia',
  'Hugo',
  'Ines',
  'Jonas',
  'Kenza',
  'Liam',
  'Maya',
  'Noah',
  'Olga',
  'Paul',
  'Rita',
  'Sami',
  'Tara',
  'Umar',
  'Vera',
  'Waris',
  'Xena',
  'Yann',
  'Zoe',
] as const

/**
 * Deterministic read-only baseline for the web-spa E2E suite. Unlike `DatabaseSeeder` /
 * `MinimalSeeder` it does not assert an empty database: `POST /api/test/seed/reset`
 * (`TestSeedModule`, test-only) truncates the business tables — keeping the Better Auth
 * ones — then re-runs this seeder between specs. `createUserData` dedupes users by email.
 */
export class E2eSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    // --- users we authenticate as -----------------------------------------------------------
    const { user: adminUser } = await createMemberData(em, {
      user: { name: E2E_USERS.admin.name, email: E2E_USERS.admin.email, emailVerified: true },
      password: E2E_PASSWORD,
      roles: ['member', 'admin'],
      status: 'active',
    })

    const { fee: memberFee } = await createMemberData(em, {
      user: { name: E2E_USERS.member.name, email: E2E_USERS.member.email, emailVerified: true },
      password: E2E_PASSWORD,
      roles: ['member'],
      status: 'active',
      expectedFeeCents: 2000,
      profile: {
        addressLine1: '12 rue des Halles',
        postalCode: '44000',
        city: 'Nantes',
        phone: '+33612345678',
      },
    })

    await createMemberData(em, {
      user: { name: E2E_USERS.pending.name, email: E2E_USERS.pending.email, emailVerified: true },
      password: E2E_PASSWORD,
      roles: ['member'],
      status: 'pending',
    })

    for (const key of ['resign', 'pwtest'] as const) {
      await createMemberData(em, {
        user: { name: E2E_USERS[key].name, email: E2E_USERS[key].email, emailVerified: true },
        password: E2E_PASSWORD,
        roles: ['member'],
        status: 'active',
      })
    }

    const { user: bannedUser } = await createMemberData(em, {
      user: { name: E2E_USERS.banned.name, email: E2E_USERS.banned.email, emailVerified: true },
      password: E2E_PASSWORD,
      roles: ['member'],
      status: 'active',
    })
    bannedUser.banned = true
    bannedUser.banReason = 'E2E fixture'
    em.persist(bannedUser)

    // A partial payment against Milo's fee, so `/account` and the fee panel read "partly paid".
    const partialPayment = new MembershipPayment()
    partialPayment.fee = memberFee
    partialPayment.kind = 'payment'
    partialPayment.amountCents = 1000
    partialPayment.method = 'cash'
    partialPayment.paidAt = new Date()
    partialPayment.recordedByUser = adminUser
    em.persist(partialPayment)

    // --- extra members so the list is paginated and searchable ------------------------------
    await createMemberData(em, {
      user: {
        name: E2E_SEARCH_MEMBER_NAME,
        email: 'zelda.searchable@e2e.local',
        emailVerified: true,
      },
      password: E2E_PASSWORD,
      status: 'active',
    })

    for (let i = 0; i < FILLER_FIRST_NAMES.length; i++) {
      await createMemberData(em, {
        user: {
          name: `${FILLER_FIRST_NAMES[i]} Filler`,
          email: `filler-${i}@e2e.local`,
          emailVerified: true,
        },
        password: E2E_PASSWORD,
        status: i % 2 === 0 ? 'pending' : 'active',
      })
    }

    // --- catalogue -------------------------------------------------------------------------
    const producer = await createSupplierData(em, { name: 'Ferme des Prés', type: 'producer' })
    await createSupplierData(em, { name: 'Grossiste Bio Sud', type: 'wholesaler' })
    const category = await createCategoryData(em, { name: 'Fruits & légumes' })

    await createProductData(em, {
      name: 'Pommes Golden',
      saleMode: 'weight',
      priceEur: 2.4,
      supplier: producer,
      category,
      setByUser: adminUser,
    })
    await createProductData(em, {
      name: 'Pain de campagne',
      saleMode: 'unit',
      priceEur: 3.2,
      supplier: producer,
      category,
      setByUser: adminUser,
    })
    await createProductData(em, {
      name: 'Cageots consignés (archivé)',
      saleMode: 'unit',
      priceEur: 1,
      supplier: producer,
      category,
      setByUser: adminUser,
      archivedAt: new Date(),
    })

    await em.flush()
  }
}
