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
import { Member } from '../modules/members/entities/member.entity'
import { OrderLine } from '../modules/orders/entities/order-line.entity'
import { Order } from '../modules/orders/entities/order.entity'
import { Product } from '../modules/catalog/entities/product.entity'
import { applySearchNormalization } from '../modules/db/search.util'
import { StockMovement } from '../modules/inventory/entities/stock-movement.entity'
import { WalletEntry } from '../modules/wallet/entities/wallet-entry.entity'
import {
  E2E_DISTRIBUTION,
  E2E_PASSWORD,
  E2E_PRODUCT_BARCODE,
  E2E_PURCHASING,
  E2E_SEARCH_MEMBER_NAME,
  E2E_USERS,
  FILLER_FIRST_NAMES,
} from './e2e.fixtures'

// Re-exported so existing importers keep working; the definitions live in `e2e.fixtures.ts`,
// which the `@grocery/web-spa-e2e` package also imports.
export {
  E2E_DISTRIBUTION,
  E2E_PASSWORD,
  E2E_PRODUCT_BARCODE,
  E2E_PURCHASING,
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
    // The E2E database is built by `schema:fresh`, which replays no migration, so the search
    // function every list endpoint calls has to be created here.
    await applySearchNormalization(em)

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

    // Lot 4: the account the distribution specs sign in as. `member,distributor` — enough
    // to run a distribution, not enough to reach any admin screen.
    await createMemberData(em, {
      user: {
        name: E2E_USERS.distributor.name,
        email: E2E_USERS.distributor.email,
        emailVerified: true,
      },
      password: E2E_PASSWORD,
      roles: ['member', 'distributor'],
      status: 'active',
    })

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
      name: 'Comté à la coupe',
      saleMode: 'weight',
      selectionUnit: 'g',
      quantityStepGrams: 200,
      orderingMode: 'in_store',
      priceEur: 25,
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

    // --- lot 3 purchasing: a dedicated supplier + pending pre-orders ------------------------
    const purchasingSupplier = await createSupplierData(em, {
      name: E2E_PURCHASING.supplierName,
      type: 'producer',
    })
    const { product: unitPreOrder } = await createProductData(em, {
      name: E2E_PURCHASING.unitProductName,
      saleMode: 'unit',
      orderingMode: 'pre_order',
      priceEur: 4,
      supplier: purchasingSupplier,
      category,
      setByUser: adminUser,
    })
    const { product: weightPreOrder } = await createProductData(em, {
      name: E2E_PURCHASING.weightProductName,
      saleMode: 'weight',
      orderingMode: 'pre_order',
      priceEur: 12,
      supplier: purchasingSupplier,
      category,
      setByUser: adminUser,
    })
    weightPreOrder.averageWeightGrams = 500
    weightPreOrder.weightTolerancePercent = 10
    em.persist(weightPreOrder)
    const { product: archivedPreOrder } = await createProductData(em, {
      name: E2E_PURCHASING.archivedProductName,
      saleMode: 'unit',
      orderingMode: 'pre_order',
      priceEur: 3,
      supplier: purchasingSupplier,
      category,
      setByUser: adminUser,
      archivedAt: new Date(),
    })

    const zelda = await em.findOneOrFail(Member, { user: { email: 'zelda.searchable@e2e.local' } })
    const milo = await em.findOneOrFail(Member, { user: { email: E2E_USERS.member.email } })

    const seedPreOrder = (member: Member, product: Product, quantity: number): void => {
      const order = new Order()
      order.member = member
      order.orderingMode = 'pre_order'
      order.status = 'pending'
      order.totalAmountCents = 0
      order.placedAt = new Date()
      const line = new OrderLine()
      line.order = order
      line.product = product
      line.productNameSnapshot = product.name
      line.quantity = String(quantity)
      line.unitPriceAmountCents = 0
      line.lineTotalAmountCents = 0
      order.lines.add(line)
      em.persist([order, line])
    }

    seedPreOrder(milo, unitPreOrder, 2)
    seedPreOrder(zelda, unitPreOrder, 3)
    seedPreOrder(zelda, weightPreOrder, 1)
    seedPreOrder(milo, archivedPreOrder, 1)

    // --- lot 4 distribution: stocked products + four members in the states the table handles
    const distributionSupplier = await createSupplierData(em, {
      name: E2E_DISTRIBUTION.supplierName,
      type: 'producer',
    })
    const { product: readyProduct } = await createProductData(em, {
      name: E2E_DISTRIBUTION.readyProductName,
      saleMode: 'unit',
      orderingMode: 'both',
      priceEur: 3,
      supplier: distributionSupplier,
      category,
      setByUser: adminUser,
    })
    const { product: weightProduct } = await createProductData(em, {
      name: E2E_DISTRIBUTION.weightProductName,
      saleMode: 'weight',
      orderingMode: 'both',
      priceEur: 20,
      supplier: distributionSupplier,
      category,
      setByUser: adminUser,
    })
    weightProduct.averageWeightGrams = 400
    weightProduct.weightTolerancePercent = 10
    em.persist(weightProduct)
    const { product: expressProduct } = await createProductData(em, {
      name: E2E_DISTRIBUTION.expressProductName,
      saleMode: 'unit',
      orderingMode: 'in_store',
      priceEur: 7,
      supplier: distributionSupplier,
      category,
      setByUser: adminUser,
    })
    expressProduct.barcode = E2E_DISTRIBUTION.expressBarcode
    em.persist(expressProduct)
    const { product: awaitingProduct } = await createProductData(em, {
      name: E2E_DISTRIBUTION.awaitingProductName,
      saleMode: 'unit',
      orderingMode: 'pre_order',
      priceEur: 2,
      supplier: distributionSupplier,
      category,
      setByUser: adminUser,
    })

    /**
     * Puts stock on the shelf without replaying lot 3's paperwork. `receptionLine` is
     * nullable, so a fixture can seed an opening balance directly; every movement the
     * application itself writes still carries its reception or handover.
     */
    const seedStock = (product: Product, quantity: number, unitCostCents: number): void => {
      const movement = new StockMovement()
      movement.product = product
      movement.quantity = String(quantity)
      movement.unitCostAmountCents = unitCostCents
      movement.currency = 'EUR'
      movement.reason = 'reception'
      em.persist(movement)
    }
    seedStock(readyProduct, 40, 200)
    seedStock(weightProduct, 10, 1400)
    seedStock(expressProduct, 25, 450)

    const seedOrder = (
      member: Member,
      orderingMode: 'pre_order' | 'in_store',
      lines: { product: Product; quantity: number; unitPriceCents: number; fulfilled?: boolean }[],
      options: { fulfilled?: boolean } = {},
    ): Order => {
      const order = new Order()
      order.member = member
      order.orderingMode = orderingMode
      order.status = 'pending'
      order.placedAt = new Date()
      let totalAmountCents = 0
      for (const entry of lines) {
        const line = new OrderLine()
        line.order = order
        line.product = entry.product
        line.productNameSnapshot = entry.product.name
        line.quantity = String(entry.quantity)
        line.unitPriceAmountCents = entry.unitPriceCents
        line.lineTotalAmountCents = Math.round(entry.quantity * entry.unitPriceCents)
        // A pre-order is only ready once lot 3 marked it fulfilled; an in-store line always is.
        // Per line, so one order can hold a delivered line beside one still waiting.
        if (orderingMode === 'pre_order' && (entry.fulfilled ?? options.fulfilled)) {
          line.fulfilledAt = new Date()
        }
        totalAmountCents += line.lineTotalAmountCents
        order.lines.add(line)
        em.persist(line)
      }
      order.totalAmountCents = totalAmountCents
      em.persist(order)
      return order
    }

    const { member: fanny } = await createMemberData(em, {
      user: {
        name: E2E_DISTRIBUTION.funded.name,
        email: E2E_DISTRIBUTION.funded.email,
        emailVerified: true,
      },
      password: E2E_PASSWORD,
      roles: ['member'],
      status: 'active',
    })
    const opening = new WalletEntry()
    opening.member = fanny
    opening.amountCents = E2E_DISTRIBUTION.funded.balanceEur * 100
    opening.currency = 'EUR'
    opening.reason = 'payment_received'
    opening.paymentMethod = 'transfer'
    em.persist(opening)
    seedOrder(
      fanny,
      'pre_order',
      [
        { product: readyProduct, quantity: 4, unitPriceCents: 300 },
        { product: weightProduct, quantity: 0.5, unitPriceCents: 2000 },
      ],
      { fulfilled: true },
    )
    seedOrder(fanny, 'in_store', [{ product: expressProduct, quantity: 1, unitPriceCents: 700 }])

    const { member: bruno } = await createMemberData(em, {
      user: {
        name: E2E_DISTRIBUTION.broke.name,
        email: E2E_DISTRIBUTION.broke.email,
        emailVerified: true,
      },
      password: E2E_PASSWORD,
      roles: ['member'],
      status: 'active',
    })
    // No wallet entry at all: balance reads 0, so any handover is refused until staff take
    // payment at the table.
    seedOrder(bruno, 'in_store', [{ product: readyProduct, quantity: 2, unitPriceCents: 300 }])

    const { member: anna } = await createMemberData(em, {
      user: {
        name: E2E_DISTRIBUTION.awaiting.name,
        email: E2E_DISTRIBUTION.awaiting.email,
        emailVerified: true,
      },
      password: E2E_PASSWORD,
      roles: ['member'],
      status: 'active',
    })
    seedOrder(anna, 'pre_order', [{ product: awaitingProduct, quantity: 3, unitPriceCents: 200 }])

    const { member: paula } = await createMemberData(em, {
      user: {
        name: E2E_DISTRIBUTION.partial.name,
        email: E2E_DISTRIBUTION.partial.email,
        emailVerified: true,
      },
      password: E2E_PASSWORD,
      roles: ['member'],
      status: 'active',
    })
    const paulaOpening = new WalletEntry()
    paulaOpening.member = paula
    paulaOpening.amountCents = E2E_DISTRIBUTION.partial.balanceEur * 100
    paulaOpening.currency = 'EUR'
    paulaOpening.reason = 'payment_received'
    paulaOpening.paymentMethod = 'transfer'
    em.persist(paulaOpening)
    // Half the delivery is in: the apples arrived, the leeks did not.
    seedOrder(paula, 'pre_order', [
      { product: readyProduct, quantity: 2, unitPriceCents: 300, fulfilled: true },
      { product: awaitingProduct, quantity: 3, unitPriceCents: 200 },
    ])

    const { member: elio } = await createMemberData(em, {
      user: {
        name: E2E_DISTRIBUTION.ended.name,
        email: E2E_DISTRIBUTION.ended.email,
        emailVerified: true,
      },
      password: E2E_PASSWORD,
      roles: ['member'],
      status: 'terminated',
    })
    seedOrder(elio, 'in_store', [{ product: readyProduct, quantity: 1, unitPriceCents: 300 }])

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
