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

  describe('POST /distribution/orders/:orderId/handovers', () => {
    it('records the handover, drops stock and charges the member together (FR-009)', async () => {
      const member = await makeMember('Fanny Funded')
      await credit(member, 6000)
      const product = await makeProduct('Apples')
      await addStock(product, 40)
      const order = await addOrder(member, product, 'in_store', { quantity: 4 })

      const res = await request
        .withSession(distributor)
        .post(`/distribution/orders/${order.id}/handovers`)
        .send({
          version: order.version,
          lines: [{ orderLineId: order.lines.getItems()[0].id, handedQuantity: 3 }],
        })

      expect(res.status).toBe(201)
      // 3 × 3.00 €, at the price recorded when the order was placed.
      expect(res.body.totalEur).toBe(9)
      expect(res.body.balanceAfterEur).toBe(51)
      expect(res.body.lines[0].handedQuantity).toBe(3)
      expect(res.body.lines[0].differenceQuantity).toBe(-1)

      const screen = await request
        .withSession(distributor)
        .get(`/distribution/members/${member.id}`)
      expect(screen.body.balanceEur).toBe(51)
      // The order left the pending list, and stock fell by what was handed over, not ordered.
      expect(screen.body.orders).toEqual([])

      em.clear()
      const movements = await em.find(StockMovement, { product: product.id })
      const onHand = movements.reduce((sum, m) => sum + Number(m.quantity), 0)
      expect(onHand).toBe(37)
    })

    it('prices a by-weight line at the weight actually handed over (FR-012)', async () => {
      const member = await makeMember('Fanny Funded')
      await credit(member, 6000)
      const { product } = await createProductData(em, {
        name: 'Comté',
        saleMode: 'weight',
        orderingMode: 'in_store',
        priceEur: 20,
      })
      await addStock(product, 10)
      const order = new Order()
      order.member = member
      order.orderingMode = 'in_store'
      order.status = 'pending'
      order.placedAt = new Date()
      const line = new OrderLine()
      line.order = order
      line.product = product
      line.productNameSnapshot = product.name
      line.quantity = '0.5'
      line.unitPriceAmountCents = 2000
      line.lineTotalAmountCents = 1000
      order.totalAmountCents = 1000
      order.lines.add(line)
      await em.persist([order, line]).flush()

      const res = await request
        .withSession(distributor)
        .post(`/distribution/orders/${order.id}/handovers`)
        .send({ version: order.version, lines: [{ orderLineId: line.id, handedQuantity: 0.6 }] })

      expect(res.status).toBe(201)
      expect(res.body.totalEur).toBe(12)
      expect(res.body.lines[0].differenceQuantity).toBeCloseTo(0.1, 3)
    })

    it('moves no stock for a line the member declined, and still settles the order', async () => {
      const member = await makeMember('Fanny Funded')
      await credit(member, 6000)
      const declined = await makeProduct('Declined apples')
      const taken = await makeProduct('Taken pears')
      await addStock(declined, 10)
      await addStock(taken, 10)

      const order = new Order()
      order.member = member
      order.orderingMode = 'in_store'
      order.status = 'pending'
      order.placedAt = new Date()
      const lines = [declined, taken].map((product) => {
        const line = new OrderLine()
        line.order = order
        line.product = product
        line.productNameSnapshot = product.name
        line.quantity = '2'
        line.unitPriceAmountCents = 300
        line.lineTotalAmountCents = 600
        order.lines.add(line)
        return line
      })
      order.totalAmountCents = 1200
      await em.persist([order, ...lines]).flush()

      const res = await request
        .withSession(distributor)
        .post(`/distribution/orders/${order.id}/handovers`)
        .send({
          version: order.version,
          lines: [
            { orderLineId: lines[0].id, handedQuantity: 0 },
            { orderLineId: lines[1].id, handedQuantity: 2 },
          ],
        })

      expect(res.status).toBe(201)
      expect(res.body.totalEur).toBe(6)

      em.clear()
      const declinedMovements = await em.find(StockMovement, { product: declined.id })
      expect(declinedMovements).toHaveLength(1) // only the opening stock
      const reloaded = await em.findOneOrFail(Order, { id: order.id })
      expect(reloaded.status).toBe('handed_over')
    })

    it('refuses when the total exceeds the balance, and moves nothing (FR-027)', async () => {
      const member = await makeMember('Bruno Broke')
      const product = await makeProduct('Apples')
      await addStock(product, 10)
      const order = await addOrder(member, product, 'in_store', { quantity: 2 })

      const res = await request
        .withSession(distributor)
        .post(`/distribution/orders/${order.id}/handovers`)
        .send({
          version: order.version,
          lines: [{ orderLineId: order.lines.getItems()[0].id, handedQuantity: 2 }],
        })

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('insufficient_balance')
      expect(res.body.shortfallEur).toBe(6)

      em.clear()
      const reloaded = await em.findOneOrFail(Order, { id: order.id })
      expect(reloaded.status).toBe('pending')
      const movements = await em.find(StockMovement, { product: product.id })
      expect(movements).toHaveLength(1) // only the opening stock
      expect(await em.count(WalletEntry, { member: member.id })).toBe(0)
    })

    it('allows a handover that spends the balance down to exactly zero', async () => {
      const member = await makeMember('Exact Change')
      await credit(member, 600)
      const product = await makeProduct('Apples')
      await addStock(product, 10)
      const order = await addOrder(member, product, 'in_store', { quantity: 2 })

      const res = await request
        .withSession(distributor)
        .post(`/distribution/orders/${order.id}/handovers`)
        .send({
          version: order.version,
          lines: [{ orderLineId: order.lines.getItems()[0].id, handedQuantity: 2 }],
        })

      expect(res.status).toBe(201)
      expect(res.body.balanceAfterEur).toBe(0)
    })

    it('refuses a second validation of the same order (SC-003)', async () => {
      const member = await makeMember('Fanny Funded')
      await credit(member, 6000)
      const product = await makeProduct('Apples')
      await addStock(product, 10)
      const order = await addOrder(member, product, 'in_store', { quantity: 2 })
      const body = {
        version: order.version,
        lines: [{ orderLineId: order.lines.getItems()[0].id, handedQuantity: 2 }],
      }

      const first = await request
        .withSession(distributor)
        .post(`/distribution/orders/${order.id}/handovers`)
        .send(body)
      expect(first.status).toBe(201)

      const second = await request
        .withSession(distributor)
        .post(`/distribution/orders/${order.id}/handovers`)
        .send(body)
      expect(second.status).toBe(409)
      expect(second.body.code).toBe('order_not_pending')

      em.clear()
      expect(await em.count(WalletEntry, { member: member.id, reason: 'handover_charge' })).toBe(1)
    })

    it('refuses a stale version — someone else validated it first (FR-011)', async () => {
      const member = await makeMember('Fanny Funded')
      await credit(member, 6000)
      const product = await makeProduct('Apples')
      await addStock(product, 10)
      const order = await addOrder(member, product, 'in_store', { quantity: 2 })

      const res = await request
        .withSession(distributor)
        .post(`/distribution/orders/${order.id}/handovers`)
        .send({
          version: order.version + 5,
          lines: [{ orderLineId: order.lines.getItems()[0].id, handedQuantity: 2 }],
        })
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('stale_version')
    })

    it('refuses a line whose goods have not arrived (FR-003)', async () => {
      const member = await makeMember('Anna Awaiting')
      await credit(member, 6000)
      const product = await makeProduct('Leeks', 'pre_order')
      const order = await addOrder(member, product, 'pre_order', { quantity: 2 })

      const res = await request
        .withSession(distributor)
        .post(`/distribution/orders/${order.id}/handovers`)
        .send({
          version: order.version,
          lines: [{ orderLineId: order.lines.getItems()[0].id, handedQuantity: 2 }],
        })
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('line_not_ready')
    })

    it('refuses a terminated member (FR-005)', async () => {
      const { member } = await createMemberData(em, {
        user: { name: 'Elio Ended', email: uniqueEmail('ended') },
        roles: ['member'],
        status: 'terminated',
      })
      await credit(member, 6000)
      const product = await makeProduct('Apples')
      await addStock(product, 10)
      const order = await addOrder(member, product, 'in_store', { quantity: 1 })

      const res = await request
        .withSession(distributor)
        .post(`/distribution/orders/${order.id}/handovers`)
        .send({
          version: order.version,
          lines: [{ orderLineId: order.lines.getItems()[0].id, handedQuantity: 1 }],
        })
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('member_terminated')
    })

    it('refuses a handover where every line is zero', async () => {
      const member = await makeMember('Fanny Funded')
      await credit(member, 6000)
      const product = await makeProduct('Apples')
      await addStock(product, 10)
      const order = await addOrder(member, product, 'in_store', { quantity: 2 })

      const res = await request
        .withSession(distributor)
        .post(`/distribution/orders/${order.id}/handovers`)
        .send({
          version: order.version,
          lines: [{ orderLineId: order.lines.getItems()[0].id, handedQuantity: 0 }],
        })
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('nothing_handed_over')
    })

    it('leaves an untouched line outstanding for a later distribution', async () => {
      const member = await makeMember('Fanny Funded')
      await credit(member, 6000)
      const first = await makeProduct('First apples')
      const second = await makeProduct('Second pears')
      await addStock(first, 10)
      await addStock(second, 10)

      const order = new Order()
      order.member = member
      order.orderingMode = 'in_store'
      order.status = 'pending'
      order.placedAt = new Date()
      const lines = [first, second].map((product) => {
        const line = new OrderLine()
        line.order = order
        line.product = product
        line.productNameSnapshot = product.name
        line.quantity = '2'
        line.unitPriceAmountCents = 300
        line.lineTotalAmountCents = 600
        order.lines.add(line)
        return line
      })
      order.totalAmountCents = 1200
      await em.persist([order, ...lines]).flush()

      const res = await request
        .withSession(distributor)
        .post(`/distribution/orders/${order.id}/handovers`)
        .send({
          version: order.version,
          lines: [{ orderLineId: lines[0].id, handedQuantity: 2 }],
        })
      expect(res.status).toBe(201)

      em.clear()
      const reloaded = await em.findOneOrFail(Order, { id: order.id })
      expect(reloaded.status).toBe('pending')
    })

    it('refuses a plain member (FR-035)', async () => {
      const member = await makeMember('Fanny Funded')
      const product = await makeProduct('Apples')
      const order = await addOrder(member, product, 'in_store')
      const res = await request
        .withSession(plainMember)
        .post(`/distribution/orders/${order.id}/handovers`)
        .send({ version: order.version, lines: [] })
      expect(res.status).toBe(403)
    })
  })

  describe('express orders', () => {
    it('lists sellable products, searchable by name and by barcode (FR-014)', async () => {
      const { product } = await createProductData(em, {
        name: 'Miel du coin',
        orderingMode: 'in_store',
        priceEur: 7,
      })
      product.barcode = '3761111111118'
      await em.persist(product).flush()
      await addStock(product, 25)

      const byName = await request
        .withSession(distributor)
        .get('/distribution/products?filter=search:like:Miel')
      expect(byName.status).toBe(200)
      expect(byName.body.data[0].unitPriceEur).toBe(7)
      expect(byName.body.data[0].quantityOnHand).toBe(25)

      const byBarcode = await request
        .withSession(distributor)
        .get('/distribution/products?filter=search:like:3761111111118')
      expect(byBarcode.body.data.map((row: { id: string }) => row.id)).toContain(product.id)
    })

    it('leaves an archived or pre-order-only product out of the sellable list', async () => {
      const { product: archived } = await createProductData(em, {
        name: 'Archived jam',
        orderingMode: 'in_store',
        archivedAt: new Date(),
      })
      const { product: preOrderOnly } = await createProductData(em, {
        name: 'Pre-order leeks',
        orderingMode: 'pre_order',
      })
      await em.flush()

      const res = await request.withSession(distributor).get('/distribution/products')
      const ids = res.body.data.map((row: { id: string }) => row.id)
      expect(ids).not.toContain(archived.id)
      expect(ids).not.toContain(preOrderOnly.id)
    })

    it('creates the order, drops stock and charges the member in one step (FR-017)', async () => {
      const member = await makeMember('Fanny Funded')
      await credit(member, 6000)
      const product = await makeProduct('Honey')
      await addStock(product, 25)

      const res = await request
        .withSession(distributor)
        .post(`/distribution/members/${member.id}/express-orders`)
        .send({ lines: [{ productId: product.id, quantity: 2 }] })

      expect(res.status).toBe(201)
      expect(res.body.totalEur).toBe(6)
      expect(res.body.balanceAfterEur).toBe(54)

      em.clear()
      const order = await em.findOneOrFail(Order, { member: member.id })
      expect(order.orderingMode).toBe('in_store')
      expect(order.status).toBe('handed_over')
      const movements = await em.find(StockMovement, { product: product.id })
      expect(movements.reduce((sum, m) => sum + Number(m.quantity), 0)).toBe(23)
    })

    it('prices a by-weight line at the current price per kilogram (FR-015)', async () => {
      const member = await makeMember('Fanny Funded')
      await credit(member, 6000)
      const { product } = await createProductData(em, {
        name: 'Comté au comptoir',
        saleMode: 'weight',
        orderingMode: 'in_store',
        priceEur: 20,
      })
      await em.flush()
      await addStock(product, 10)

      const res = await request
        .withSession(distributor)
        .post(`/distribution/members/${member.id}/express-orders`)
        .send({ lines: [{ productId: product.id, quantity: 0.35 }] })

      expect(res.status).toBe(201)
      expect(res.body.totalEur).toBe(7)
    })

    it('sells past the recorded stock rather than blocking, and lets it go negative', async () => {
      const member = await makeMember('Fanny Funded')
      await credit(member, 6000)
      const product = await makeProduct('Scarce honey')
      await addStock(product, 1)

      const res = await request
        .withSession(distributor)
        .post(`/distribution/members/${member.id}/express-orders`)
        .send({ lines: [{ productId: product.id, quantity: 3 }] })
      expect(res.status).toBe(201)

      em.clear()
      const movements = await em.find(StockMovement, { product: product.id })
      expect(movements.reduce((sum, m) => sum + Number(m.quantity), 0)).toBe(-2)
    })

    it('refuses an archived product', async () => {
      const member = await makeMember('Fanny Funded')
      await credit(member, 6000)
      const { product } = await createProductData(em, {
        name: 'Archived jam',
        orderingMode: 'in_store',
        archivedAt: new Date(),
      })
      await em.flush()

      const res = await request
        .withSession(distributor)
        .post(`/distribution/members/${member.id}/express-orders`)
        .send({ lines: [{ productId: product.id, quantity: 1 }] })
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('product_not_sellable')
    })

    it('refuses when the balance does not cover it, and creates no order', async () => {
      const member = await makeMember('Bruno Broke')
      const product = await makeProduct('Honey')
      await addStock(product, 10)

      const res = await request
        .withSession(distributor)
        .post(`/distribution/members/${member.id}/express-orders`)
        .send({ lines: [{ productId: product.id, quantity: 2 }] })
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('insufficient_balance')

      em.clear()
      expect(await em.count(Order, { member: member.id })).toBe(0)
      const movements = await em.find(StockMovement, { product: product.id })
      expect(movements).toHaveLength(1) // only the opening stock
    })

    it('rejects an empty line list before it reaches the service (FR-019)', async () => {
      const member = await makeMember('Fanny Funded')
      const res = await request
        .withSession(distributor)
        .post(`/distribution/members/${member.id}/express-orders`)
        .send({ lines: [] })
      expect(res.status).toBe(400)
    })

    it('refuses a plain member', async () => {
      const member = await makeMember('Fanny Funded')
      const res = await request
        .withSession(plainMember)
        .post(`/distribution/members/${member.id}/express-orders`)
        .send({ lines: [] })
      expect(res.status).toBe(403)
    })
  })
})
