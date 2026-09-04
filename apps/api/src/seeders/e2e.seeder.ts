import { EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { hashPassword } from 'better-auth/crypto'
import { Account } from '../modules/auth/auth.entity'
import {
  createCategoryData,
  createProductData,
  createSupplierData,
} from '../modules/catalog/catalog.factory'
import { MembershipPayment } from '../modules/members/entities/membership-payment.entity'
import { createMemberData } from '../modules/members/members.factory'
import {
  E2E_PASSWORD,
  E2E_PRODUCT_BARCODE,
  E2E_SEARCH_MEMBER_NAME,
  E2E_USERS,
  FILLER_FIRST_NAMES,
} from './e2e.fixtures'

// Re-exported so existing importers keep working; the definitions live in `e2e.fixtures.ts`,
// which the `@grocery/web-spa-e2e` package also imports.
export {
  E2E_PASSWORD,
  E2E_PRODUCT_BARCODE,
  E2E_SEARCH_MEMBER_NAME,
  E2E_USERS,
} from './e2e.fixtures'

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
    const emptyCategory = await createCategoryData(em, { name: 'Épicerie (archivée)' })

    await createProductData(em, {
      name: 'Pommes Golden',
      saleMode: 'weight',
      orderingMode: 'in_store',
      priceEur: 2.4,
      supplier: producer,
      category,
      setByUser: adminUser,
    })
    await createProductData(em, {
      name: 'Pain de campagne',
      saleMode: 'unit',
      orderingMode: 'in_store',
      priceEur: 3.2,
      supplier: producer,
      category,
      setByUser: adminUser,
    })
    await createProductData(em, {
      name: 'Cageots consignés (archivé)',
      saleMode: 'unit',
      orderingMode: 'in_store',
      priceEur: 1,
      supplier: producer,
      category,
      setByUser: adminUser,
      archivedAt: new Date(),
    })
    await createProductData(em, {
      name: 'Panier de légumes du producteur',
      saleMode: 'unit',
      orderingMode: 'pre_order',
      priceEur: 18,
      supplier: producer,
      category,
      setByUser: adminUser,
    })
    await createProductData(em, {
      name: 'Carottes en vrac',
      saleMode: 'weight',
      orderingMode: 'both',
      priceEur: 1.9,
      supplier: producer,
      category,
      setByUser: adminUser,
    })
    const { product: barcodeProduct } = await createProductData(em, {
      name: 'Farine T65',
      saleMode: 'unit',
      orderingMode: 'in_store',
      priceEur: 1.5,
      supplier: producer,
      category,
      setByUser: adminUser,
    })
    barcodeProduct.barcode = E2E_PRODUCT_BARCODE
    em.persist(barcodeProduct)
    await createProductData(em, {
      name: 'Article de catégorie archivée',
      saleMode: 'unit',
      orderingMode: 'in_store',
      priceEur: 1,
      supplier: producer,
      category: emptyCategory,
      setByUser: adminUser,
      archivedAt: new Date(),
    })

    // --- restore the canonical password ---------------------------------------------------
    // `POST /api/test/seed/reset` keeps the Better Auth tables, and `createUserData` leaves an
    // existing account's password untouched. A spec that rotates a password (account.spec)
    // would otherwise strand that account on the new value, since `afterAll(reseed)` cannot
    // reach it. Force every seeded credential back to `E2E_PASSWORD` on each run so a reseed
    // is authoritative.
    const seededAccounts = await em.find(Account, {
      providerId: 'credential',
      user: { email: { $like: '%@e2e.local' } },
    })
    const hashed = await hashPassword(E2E_PASSWORD)
    for (const account of seededAccounts) {
      account.password = hashed
    }

    await em.flush()
  }
}
