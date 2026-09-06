import type { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it } from 'vitest'
/**
 * E2E tests for the read-only back-office inventory endpoints (all `@AdminOnly()`). Stock is
 * only ever written by recording a reception (purchasing module); these tests arrange stock
 * both ways — directly via `StockMovement` rows, and through the full aggregate→send→receive
 * flow for the weighted-average-cost case.
 */
import { initializeTestApp } from '../../../test/helpers/test-app.helper'
import {
  createRequest,
  createSessionFromUser,
  type TestRequest,
} from '../../../test/helpers/test-auth.helper'
import { createProductData, createSupplierData } from '../../catalog/catalog.factory'
import { CatalogModule } from '../../catalog/catalog.module'
import { createMemberData } from '../../members/members.factory'
import { Member } from '../../members/entities/member.entity'
import { OrderLine } from '../../orders/entities/order-line.entity'
import { Order } from '../../orders/entities/order.entity'
import { Product } from '../../catalog/entities/product.entity'
import { PurchasingModule } from '../../purchasing/purchasing.module'
import { StockMovement } from '../entities/stock-movement.entity'
import { InventoryModule } from '../inventory.module'

describe('inventoryController (e2e)', () => {
  let em: EntityManager
  let request: TestRequest
  let admin: ReturnType<typeof createSessionFromUser>

  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      { imports: [InventoryModule, PurchasingModule, CatalogModule] },
    )
    context.app = app
    em = orm.em.fork()
    request = createRequest(app)
    const { user } = await createMemberData(em, {
      user: { name: 'Admin', email: `admin-${Math.random().toString(36).slice(2)}@example.com` },
      roles: ['member', 'admin'],
      status: 'active',
    })
    admin = createSessionFromUser(user)
  })

  async function makeProduct(name: string) {
    const { product } = await createProductData(em, { name, orderingMode: 'pre_order' })
    return product
  }

  async function addMovement(product: Product, quantity: number, unitCostCents: number) {
    const movement = new StockMovement()
    movement.product = product
    movement.quantity = String(quantity)
    movement.unitCostAmountCents = unitCostCents
    movement.currency = 'EUR'
    movement.reason = 'reception'
    await em.persist(movement).flush()
  }

  describe('GET /admin/inventory/stock', () => {
    it('lists every product, with a never-received one at 0 / null (FR-020)', async () => {
      const received = await makeProduct('Received carrots')
      await makeProduct('Untouched apples')
      await addMovement(received, 12, 150)

      const res = await request.withSession(admin).get('/admin/inventory/stock')
      expect(res.status).toBe(200)

      const byName = Object.fromEntries(
        res.body.data.map((row: { product: { name: string } }) => [row.product.name, row]),
      )
      expect(byName['Received carrots'].quantityOnHand).toBe(12)
      expect(byName['Received carrots'].costPriceEur).toBe(1.5)
      expect(byName['Untouched apples'].quantityOnHand).toBe(0)
      expect(byName['Untouched apples'].costPriceEur).toBeNull()
    })
  })

  describe('GET /admin/inventory/products/:productId/stock', () => {
    it('returns 0 / null / empty movements for a never-received product, not a 404 (FR-020)', async () => {
      const product = await makeProduct('Never received')
      const res = await request
        .withSession(admin)
        .get(`/admin/inventory/products/${product.id}/stock`)
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ quantityOnHand: 0, costPriceEur: null, movements: [] })
    })

    it('404s a product id that does not exist at all', async () => {
      const res = await request
        .withSession(admin)
        .get('/admin/inventory/products/00000000-0000-0000-0000-000000000000/stock')
      expect(res.status).toBe(404)
    })

    it('shows the quantity-weighted average across two receptions at different unit costs', async () => {
      const supplier = await createSupplierData(em)
      const { product } = await createProductData(em, {
        name: 'Twice received',
        supplier,
        orderingMode: 'pre_order',
      })
      const { member } = await createMemberData(em, {
        user: { email: `buyer-${Math.random().toString(36).slice(2)}@example.com` },
        status: 'active',
      })
      const order = new Order()
      order.member = member as Member
      order.orderingMode = 'pre_order'
      order.status = 'pending'
      order.totalAmountCents = 0
      order.placedAt = new Date()
      const line = new OrderLine()
      line.order = order
      line.product = product
      line.productNameSnapshot = product.name
      line.quantity = '40'
      line.unitPriceAmountCents = 0
      line.lineTotalAmountCents = 0
      order.lines.add(line)
      await em.persist([order, line]).flush()

      const agg = await request
        .withSession(admin)
        .post(`/admin/suppliers/${supplier.id}/purchasing/aggregate`)
      const so = agg.body.supplierOrder
      await request
        .withSession(admin)
        .post(`/admin/purchasing/supplier-orders/${so.id}/send`)
        .send({ version: so.version })
      const soLineId = so.lines[0].id

      // 10 @ 1.00 € then 30 @ 1.40 € → (1000 + 4200) / 40 = 130 cents = 1.30 €
      await request
        .withSession(admin)
        .post(`/admin/purchasing/supplier-orders/${so.id}/receptions`)
        .send({ lines: [{ supplierOrderLineId: soLineId, receivedQuantity: 10, unitCostEur: 1 }] })
      await request
        .withSession(admin)
        .post(`/admin/purchasing/supplier-orders/${so.id}/receptions`)
        .send({
          lines: [{ supplierOrderLineId: soLineId, receivedQuantity: 30, unitCostEur: 1.4 }],
        })

      const res = await request
        .withSession(admin)
        .get(`/admin/inventory/products/${product.id}/stock`)
      expect(res.body.quantityOnHand).toBe(40)
      expect(res.body.costPriceEur).toBe(1.3)
      expect(res.body.movements).toHaveLength(2)
      // Every movement traces back to a reception line (SC-003).
      expect(
        res.body.movements.every((m: { receptionLineId: string | null }) => m.receptionLineId),
      ).toBe(true)
    })
  })

  it('401s anonymous and 403s a non-admin', async () => {
    expect((await request.get('/admin/inventory/stock')).status).toBe(401)
    const { user } = await createMemberData(em, {
      user: { email: `plain-${Math.random().toString(36).slice(2)}@example.com` },
      status: 'active',
    })
    const res = await request.withSession(createSessionFromUser(user)).get('/admin/inventory/stock')
    expect(res.status).toBe(403)
  })
})
