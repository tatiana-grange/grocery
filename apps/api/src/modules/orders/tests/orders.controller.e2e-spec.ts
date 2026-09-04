import type { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it } from 'vitest'
/**
 * E2E tests for the `orders` module: `/cart/*` (this phase) and `/orders/*` (added by later
 * phases) — one e2e file per the module's fixed test-file shape (see catalog precedent).
 */
import { initializeTestApp } from '../../../test/helpers/test-app.helper'
import {
  createRequest,
  createSessionFromUser,
  type TestRequest,
} from '../../../test/helpers/test-auth.helper'
import { createProductData } from '../../catalog/catalog.factory'
import { Product } from '../../catalog/entities/product.entity'
import { CatalogModule } from '../../catalog/catalog.module'
import { Member } from '../../members/entities/member.entity'
import { createMemberData } from '../../members/members.factory'
import { OrdersModule } from '../orders.module'

describe('ordersController (e2e)', () => {
  let em: EntityManager
  let request: TestRequest
  let member: ReturnType<typeof createSessionFromUser>

  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      { imports: [OrdersModule, CatalogModule] },
    )
    context.app = app
    em = orm.em.fork()
    request = createRequest(app)
    const { user } = await createMemberData(em, { roles: ['member'], status: 'active' })
    member = createSessionFromUser(user)
  })

  async function makeProduct(overrides: Parameters<typeof createProductData>[1] = {}) {
    const { product } = await createProductData(em, {
      name: 'Carrots',
      saleMode: 'unit',
      orderingMode: 'in_store',
      priceEur: 1.5,
      ...overrides,
    })
    return product
  }

  describe('GET /cart', () => {
    it('creates an empty cart on first read', async () => {
      const res = await request.withSession(member).get('/cart')
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ lines: [], totalEur: 0 })
    })

    it('401s unauthenticated and 403s a pending member', async () => {
      expect((await request.get('/cart')).status).toBe(401)

      const { user: pending } = await createMemberData(em, { status: 'pending' })
      const res = await request.withSession(createSessionFromUser(pending)).get('/cart')
      expect(res.status).toBe(403)
    })
  })

  describe('POST /cart/lines', () => {
    it('adds a line and merges quantity on a repeat add of the same product + ordering mode', async () => {
      const product = await makeProduct()

      const first = await request
        .withSession(member)
        .post('/cart/lines')
        .send({ productId: product.id, orderingMode: 'in_store', quantity: 2 })
      expect(first.status).toBe(201)
      expect(first.body.lines).toHaveLength(1)
      expect(first.body.lines[0].quantity).toBe(2)

      const second = await request
        .withSession(member)
        .post('/cart/lines')
        .send({ productId: product.id, orderingMode: 'in_store', quantity: 3 })
      expect(second.status).toBe(201)
      expect(second.body.lines).toHaveLength(1)
      expect(second.body.lines[0].quantity).toBe(5)
    })

    it('creates a second line for the same product under the other ordering mode', async () => {
      const product = await makeProduct({ orderingMode: 'both' })

      await request
        .withSession(member)
        .post('/cart/lines')
        .send({ productId: product.id, orderingMode: 'in_store', quantity: 1 })
      const res = await request
        .withSession(member)
        .post('/cart/lines')
        .send({ productId: product.id, orderingMode: 'pre_order', quantity: 1 })

      expect(res.status).toBe(201)
      expect(res.body.lines).toHaveLength(2)
    })

    it('409s when the requested ordering mode is not offered by the product', async () => {
      const product = await makeProduct({ orderingMode: 'pre_order' })
      const res = await request
        .withSession(member)
        .post('/cart/lines')
        .send({ productId: product.id, orderingMode: 'in_store', quantity: 1 })
      expect(res.status).toBe(409)
    })

    it('422s a non-integer quantity for a unit product', async () => {
      const product = await makeProduct({ saleMode: 'unit' })
      const res = await request
        .withSession(member)
        .post('/cart/lines')
        .send({ productId: product.id, orderingMode: 'in_store', quantity: 1.5 })
      expect(res.status).toBe(422)
    })

    it('422s more than 3 decimals for a weight product', async () => {
      const product = await makeProduct({ saleMode: 'weight' })
      const res = await request
        .withSession(member)
        .post('/cart/lines')
        .send({ productId: product.id, orderingMode: 'in_store', quantity: 1.2345 })
      expect(res.status).toBe(422)
    })

    it('401s unauthenticated and 403s a pending member', async () => {
      const product = await makeProduct()
      expect(
        (
          await request
            .post('/cart/lines')
            .send({ productId: product.id, orderingMode: 'in_store', quantity: 1 })
        ).status,
      ).toBe(401)

      const { user: pending } = await createMemberData(em, { status: 'pending' })
      const res = await request
        .withSession(createSessionFromUser(pending))
        .post('/cart/lines')
        .send({ productId: product.id, orderingMode: 'in_store', quantity: 1 })
      expect(res.status).toBe(403)
    })
  })

  describe('PUT/DELETE /cart/lines/:lineId', () => {
    async function addLine(quantity = 1, orderingMode: 'pre_order' | 'in_store' = 'in_store') {
      const product = await makeProduct({ orderingMode: 'both' })
      const res = await request
        .withSession(member)
        .post('/cart/lines')
        .send({ productId: product.id, orderingMode, quantity })
      return { product, lineId: res.body.lines[0].id as string }
    }

    it('updates a line quantity', async () => {
      const { lineId } = await addLine(1)
      const res = await request
        .withSession(member)
        .put(`/cart/lines/${lineId}`)
        .send({ quantity: 4 })
      expect(res.status).toBe(200)
      expect(res.body.lines[0].quantity).toBe(4)
    })

    it('removes a line', async () => {
      const { lineId } = await addLine(1)
      const res = await request.withSession(member).del(`/cart/lines/${lineId}`)
      expect(res.status).toBe(200)
      expect(res.body.lines).toHaveLength(0)
    })

    it('404s for a line that is not the caller\'s', async () => {
      const { lineId } = await addLine(1)
      const { user: other } = await createMemberData(em, { roles: ['member'], status: 'active' })
      const res = await request
        .withSession(createSessionFromUser(other))
        .put(`/cart/lines/${lineId}`)
        .send({ quantity: 2 })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /cart/checkout', () => {
    it('splits a mixed cart into two orders, each with its own lines and total', async () => {
      const inStore = await makeProduct({ name: 'Milk', orderingMode: 'in_store', priceEur: 2 })
      const preOrder = await makeProduct({ name: 'Basket', orderingMode: 'pre_order', priceEur: 10 })
      await request
        .withSession(member)
        .post('/cart/lines')
        .send({ productId: inStore.id, orderingMode: 'in_store', quantity: 3 })
      await request
        .withSession(member)
        .post('/cart/lines')
        .send({ productId: preOrder.id, orderingMode: 'pre_order', quantity: 2 })

      const res = await request.withSession(member).post('/cart/checkout')
      expect(res.status).toBe(201)
      expect(res.body.orders).toHaveLength(2)

      const inStoreOrder = res.body.orders.find(
        (order: { orderingMode: string }) => order.orderingMode === 'in_store',
      )
      const preOrderOrder = res.body.orders.find(
        (order: { orderingMode: string }) => order.orderingMode === 'pre_order',
      )
      expect(inStoreOrder.totalEur).toBe(6)
      expect(inStoreOrder.lines).toHaveLength(1)
      expect(preOrderOrder.totalEur).toBe(20)
      expect(preOrderOrder.lines).toHaveLength(1)

      const cart = await request.withSession(member).get('/cart')
      expect(cart.body.lines).toHaveLength(0)
    })

    it('409s on an empty cart', async () => {
      const res = await request.withSession(member).post('/cart/checkout')
      expect(res.status).toBe(409)
    })

    it('charges the current price, not the one at add-to-cart time', async () => {
      const product = await makeProduct({ orderingMode: 'in_store', priceEur: 2 })
      await request
        .withSession(member)
        .post('/cart/lines')
        .send({ productId: product.id, orderingMode: 'in_store', quantity: 1 })

      const { user: adminUser } = await createMemberData(em, {
        roles: ['member', 'admin'],
        status: 'active',
      })
      await request
        .withSession(createSessionFromUser(adminUser))
        .post(`/admin/products/${product.id}/price`)
        .send({ amountEur: 5 })

      const res = await request.withSession(member).post('/cart/checkout')
      expect(res.status).toBe(201)
      expect(res.body.orders[0].totalEur).toBe(5)
    })

    it('drops an archived product from checkout and reports it — the rest still succeeds', async () => {
      const archivable = await makeProduct({ name: 'Doomed', orderingMode: 'in_store' })
      const keeper = await makeProduct({ name: 'Keeper', orderingMode: 'in_store' })
      await request
        .withSession(member)
        .post('/cart/lines')
        .send({ productId: archivable.id, orderingMode: 'in_store', quantity: 1 })
      await request
        .withSession(member)
        .post('/cart/lines')
        .send({ productId: keeper.id, orderingMode: 'in_store', quantity: 1 })

      const { user: adminUser } = await createMemberData(em, {
        roles: ['member', 'admin'],
        status: 'active',
      })
      await request
        .withSession(createSessionFromUser(adminUser))
        .post(`/admin/products/${archivable.id}/archive`)

      const res = await request.withSession(member).post('/cart/checkout')
      expect(res.status).toBe(201)
      expect(res.body.droppedLines).toHaveLength(1)
      expect(res.body.droppedLines[0].productName).toBe('Doomed')
      expect(res.body.orders).toHaveLength(1)
      expect(res.body.orders[0].lines).toHaveLength(1)
      expect(res.body.orders[0].lines[0].productName).toBe('Keeper')
    })

    it('403s and leaves the cart intact when the member is no longer active', async () => {
      const { user: activeUser, member: memberEntity } = await createMemberData(em, {
        roles: ['member'],
        status: 'active',
      })
      const activeSession = createSessionFromUser(activeUser)
      const product = await makeProduct()
      await request
        .withSession(activeSession)
        .post('/cart/lines')
        .send({ productId: product.id, orderingMode: 'in_store', quantity: 1 })

      const toTerminate = await em.findOneOrFail(Member, { id: memberEntity.id })
      toTerminate.status = 'terminated'
      em.persist(toTerminate)
      await em.flush()
      em.clear()

      const checkoutRes = await request.withSession(activeSession).post('/cart/checkout')
      expect(checkoutRes.status).toBe(403)

      // Reactivate to confirm the 403 didn't touch the cart's lines.
      const reactivated = await em.findOneOrFail(Member, { id: memberEntity.id })
      reactivated.status = 'active'
      em.persist(reactivated)
      await em.flush()

      const cartRes = await request.withSession(activeSession).get('/cart')
      expect(cartRes.body.lines).toHaveLength(1)
    })
  })

  describe('invalid lines', () => {
    it('a line whose product ordering mode was narrowed after it was added comes back isValid: false', async () => {
      const product = await makeProduct({ orderingMode: 'both' })
      await request
        .withSession(member)
        .post('/cart/lines')
        .send({ productId: product.id, orderingMode: 'pre_order', quantity: 1 })

      const toNarrow = await em.findOneOrFail(Product, { id: product.id })
      toNarrow.orderingMode = 'in_store'
      em.persist(toNarrow)
      await em.flush()
      em.clear()

      const res = await request.withSession(member).get('/cart')
      expect(res.status).toBe(200)
      expect(res.body.lines).toHaveLength(1)
      expect(res.body.lines[0].isValid).toBe(false)
      expect(res.body.lines[0].invalidReason).toBeTruthy()
    })
  })
})
