import type { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it } from 'vitest'
/**
 * E2E tests for the distribution table (every route `@StaffOnly()`). US1 covers the reads:
 * finding a member and building their screen.
 */
import { initializeTestApp } from '../../../test/helpers/test-app.helper'
import {
  createRequest,
  createSessionFromUser,
  type TestRequest,
} from '../../../test/helpers/test-auth.helper'
import { createProductData } from '../../catalog/catalog.factory'
import { CatalogModule } from '../../catalog/catalog.module'
import { Product } from '../../catalog/entities/product.entity'
import { StockMovement } from '../../inventory/entities/stock-movement.entity'
import { InventoryModule } from '../../inventory/inventory.module'
import { Member } from '../../members/entities/member.entity'
import { createMemberData } from '../../members/members.factory'
import { OrderLine } from '../../orders/entities/order-line.entity'
import { Order } from '../../orders/entities/order.entity'
import { WalletEntry } from '../../wallet/entities/wallet-entry.entity'
import { WalletModule } from '../../wallet/wallet.module'
import { DistributionModule } from '../distribution.module'

describe('distributionController (e2e)', () => {
  let em: EntityManager
  let request: TestRequest
  let distributor: ReturnType<typeof createSessionFromUser>
  let plainMember: ReturnType<typeof createSessionFromUser>

  const uniqueEmail = (prefix: string) =>
    `${prefix}-${Math.random().toString(36).slice(2)}@example.com`

  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      { imports: [DistributionModule, WalletModule, InventoryModule, CatalogModule] },
    )
    context.app = app
    em = orm.em.fork()
    request = createRequest(app)

    const { user: staffUser } = await createMemberData(em, {
      user: { name: 'Dina Distributor', email: uniqueEmail('distributor') },
      roles: ['member', 'distributor'],
      status: 'active',
    })
    distributor = createSessionFromUser(staffUser)

    const { user: memberUser } = await createMemberData(em, {
      user: { name: 'Plain Member', email: uniqueEmail('plain') },
      roles: ['member'],
      status: 'active',
    })
    plainMember = createSessionFromUser(memberUser)
  })

  async function makeMember(name: string) {
    const { member } = await createMemberData(em, {
      user: { name, email: uniqueEmail('shopper') },
      roles: ['member'],
      status: 'active',
    })
    return member
  }

  async function makeProduct(name: string, orderingMode: 'pre_order' | 'in_store' = 'in_store') {
    const { product } = await createProductData(em, { name, orderingMode, priceEur: 3 })
    return product
  }

  async function addStock(product: Product, quantity: number) {
    const movement = new StockMovement()
    movement.product = product
    movement.quantity = String(quantity)
    movement.unitCostAmountCents = 200
    movement.currency = 'EUR'
    movement.reason = 'reception'
    await em.persist(movement).flush()
  }

  async function addOrder(
    member: Member,
    product: Product,
    orderingMode: 'pre_order' | 'in_store',
    options: { quantity?: number; fulfilled?: boolean } = {},
  ) {
    const quantity = options.quantity ?? 2
    const order = new Order()
    order.member = member
    order.orderingMode = orderingMode
    order.status = 'pending'
    order.placedAt = new Date()
    const line = new OrderLine()
    line.order = order
    line.product = product
    line.productNameSnapshot = product.name
    line.quantity = String(quantity)
    line.unitPriceAmountCents = 300
    line.lineTotalAmountCents = Math.round(quantity * 300)
    if (options.fulfilled) line.fulfilledAt = new Date()
    order.totalAmountCents = line.lineTotalAmountCents
    order.lines.add(line)
    await em.persist([order, line]).flush()
    return order
  }

  async function credit(member: Member, amountCents: number) {
    const entry = new WalletEntry()
    entry.member = member
    entry.amountCents = amountCents
    entry.currency = 'EUR'
    entry.reason = 'payment_received'
    entry.paymentMethod = 'cash'
    await em.persist(entry).flush()
  }

  describe('GET /distribution/members', () => {
    it('finds a member by name', async () => {
      const member = await makeMember('Fanny Funded')
      await credit(member, 6000)

      const res = await request
        .withSession(distributor)
        .get('/distribution/members?filter=search:like:Fanny')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].name).toBe('Fanny Funded')
      expect(res.body.data[0].balanceEur).toBe(60)
    })

    it('finds the same member by membership number', async () => {
      const member = await makeMember('Fanny Funded')
      const res = await request
        .withSession(distributor)
        .get(`/distribution/members?filter=search:like:${member.membershipNumber}`)
      expect(res.status).toBe(200)
      expect(res.body.data.map((row: { id: string }) => row.id)).toContain(member.id)
    })

    it('counts what each member still has waiting', async () => {
      const member = await makeMember('Fanny Funded')
      const product = await makeProduct('Apples')
      await addOrder(member, product, 'in_store')

      const res = await request
        .withSession(distributor)
        .get('/distribution/members?filter=search:like:Fanny')
      expect(res.body.data[0].outstandingOrderCount).toBe(1)
    })

    it('refuses a plain member (FR-035)', async () => {
      const res = await request.withSession(plainMember).get('/distribution/members')
      expect(res.status).toBe(403)
    })

    it('refuses an anonymous caller', async () => {
      const res = await request.get('/distribution/members')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /distribution/members/:memberId', () => {
    it('returns the balance, the orders, and the shelf quantity beside each line', async () => {
      const member = await makeMember('Fanny Funded')
      await credit(member, 6000)
      const product = await makeProduct('Apples')
      await addStock(product, 40)
      await addOrder(member, product, 'in_store', { quantity: 4 })

      const res = await request.withSession(distributor).get(`/distribution/members/${member.id}`)
      expect(res.status).toBe(200)
      expect(res.body.balanceEur).toBe(60)
      expect(res.body.orders).toHaveLength(1)

      const [line] = res.body.orders[0].lines
      expect(line.orderedQuantity).toBe(4)
      expect(line.availableQuantity).toBe(40)
      expect(line.unitPriceEur).toBe(3)
      expect(line.isReady).toBe(true)
    })

    it('marks a pre-order line not ready until its goods arrive (FR-003)', async () => {
      const member = await makeMember('Anna Awaiting')
      const product = await makeProduct('Leeks', 'pre_order')
      await addOrder(member, product, 'pre_order')

      const res = await request.withSession(distributor).get(`/distribution/members/${member.id}`)
      expect(res.body.orders[0].isReady).toBe(false)
      expect(res.body.orders[0].lines[0].notReadyReason).toBe('awaiting_reception')
    })

    it('marks a pre-order line ready once lot 3 fulfilled it', async () => {
      const member = await makeMember('Fanny Funded')
      const product = await makeProduct('Cheese', 'pre_order')
      await addStock(product, 10)
      await addOrder(member, product, 'pre_order', { fulfilled: true })

      const res = await request.withSession(distributor).get(`/distribution/members/${member.id}`)
      expect(res.body.orders[0].isReady).toBe(true)
      expect(res.body.orders[0].lines[0].notReadyReason).toBeNull()
    })

    it('returns an empty order list, not a 404, for a member with nothing waiting', async () => {
      const member = await makeMember('Nobody Waiting')

      const res = await request.withSession(distributor).get(`/distribution/members/${member.id}`)
      expect(res.status).toBe(200)
      expect(res.body.orders).toEqual([])
      expect(res.body.balanceEur).toBe(0)
    })

    it('reports a shelf quantity of 0 for a product never received', async () => {
      const member = await makeMember('Fanny Funded')
      const product = await makeProduct('Never received')
      await addOrder(member, product, 'in_store')

      const res = await request.withSession(distributor).get(`/distribution/members/${member.id}`)
      expect(res.body.orders[0].lines[0].availableQuantity).toBe(0)
    })

    it('404s an unknown member', async () => {
      const res = await request
        .withSession(distributor)
        .get('/distribution/members/00000000-0000-4000-8000-000000000000')
      expect(res.status).toBe(404)
    })
  })
})
