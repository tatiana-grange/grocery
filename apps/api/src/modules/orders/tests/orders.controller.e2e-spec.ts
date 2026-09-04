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
