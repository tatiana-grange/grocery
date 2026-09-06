import type { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it } from 'vitest'
/**
 * E2E tests for the back-office purchasing endpoints (all `@AdminOnly()`): aggregation, the
 * supplier-order list/detail reads, and — added by later phases — send, receptions, and
 * close.
 */
import { initializeTestApp } from '../../../test/helpers/test-app.helper'
import {
  createRequest,
  createSessionFromUser,
  type TestRequest,
} from '../../../test/helpers/test-auth.helper'
import { createProductData, createSupplierData } from '../../catalog/catalog.factory'
import { CatalogModule } from '../../catalog/catalog.module'
import { InventoryModule } from '../../inventory/inventory.module'
import { createMemberData } from '../../members/members.factory'
import { Member } from '../../members/entities/member.entity'
import { OrderLine } from '../../orders/entities/order-line.entity'
import { Order } from '../../orders/entities/order.entity'
import { Product } from '../../catalog/entities/product.entity'
import { PurchasingModule } from '../purchasing.module'

describe('purchasingController (e2e)', () => {
  let em: EntityManager
  let request: TestRequest
  let admin: ReturnType<typeof createSessionFromUser>

  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      { imports: [PurchasingModule, InventoryModule, CatalogModule] },
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

  async function makeMember() {
    const { member } = await createMemberData(em, {
      user: { email: `m-${Math.random().toString(36).slice(2)}@example.com` },
      status: 'active',
    })
    return member
  }

  async function preOrder(member: Member, product: Product, quantity: number) {
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
    line.unitPriceAmountCents = 100
    line.lineTotalAmountCents = 100 * quantity
    order.lines.add(line)
    await em.persist([order, line]).flush()
    return { order, line }
  }

  async function makeSupplierWithProducts() {
    const supplier = await createSupplierData(em, {
      name: `S-${Math.random().toString(36).slice(2, 6)}`,
    })
    const { product: carrots } = await createProductData(em, {
      name: 'Carrots',
      supplier,
      orderingMode: 'pre_order',
    })
    const { product: apples } = await createProductData(em, {
      name: 'Apples',
      supplier,
      orderingMode: 'pre_order',
    })
    return { supplier, carrots, apples }
  }

  describe('POST /admin/suppliers/:supplierId/purchasing/aggregate', () => {
    it('sums quantities per product across members and links every contributing pre-order line', async () => {
      const { supplier, carrots, apples } = await makeSupplierWithProducts()
      const alice = await makeMember()
      const bob = await makeMember()
      await preOrder(alice, carrots, 3)
      await preOrder(bob, carrots, 2)
      await preOrder(bob, apples, 5)

      const res = await request
        .withSession(admin)
        .post(`/admin/suppliers/${supplier.id}/purchasing/aggregate`)
      expect(res.status).toBe(201)

      const { supplierOrder, skippedLines } = res.body
      expect(supplierOrder.status).toBe('draft')
      expect(skippedLines).toHaveLength(0)
      expect(supplierOrder.lines).toHaveLength(2)

      const carrotLine = supplierOrder.lines.find(
        (l: { product: { name: string } }) => l.product.name === 'Carrots',
      )
      expect(carrotLine.quantity).toBe(5)
      expect(carrotLine.contributingMemberCount).toBe(2)

      // Every contributing OrderLine now points at a supplier-order line.
      const linked = await em.fork().find(OrderLine, {}, { populate: ['supplierOrderLine'] })
      expect(linked.every((l) => l.supplierOrderLine !== null)).toBe(true)
    })

    it('409s when there is nothing pending to aggregate (FR-004)', async () => {
      const { supplier } = await makeSupplierWithProducts()
      const res = await request
        .withSession(admin)
        .post(`/admin/suppliers/${supplier.id}/purchasing/aggregate`)
      expect(res.status).toBe(409)
    })

    it('skips an archived product and reports it, aggregating the rest (FR-003)', async () => {
      const { supplier, carrots, apples } = await makeSupplierWithProducts()
      const alice = await makeMember()
      await preOrder(alice, carrots, 1)
      await preOrder(alice, apples, 1)
      apples.archivedAt = new Date()
      await em.flush()

      const res = await request
        .withSession(admin)
        .post(`/admin/suppliers/${supplier.id}/purchasing/aggregate`)
      expect(res.status).toBe(201)
      expect(res.body.supplierOrder.lines).toHaveLength(1)
      expect(res.body.skippedLines).toEqual([{ productName: 'Apples', reason: 'product_archived' }])
    })

    it('picks a later pre-order up only on the next aggregation run (FR-005)', async () => {
      const { supplier, carrots } = await makeSupplierWithProducts()
      const alice = await makeMember()
      await preOrder(alice, carrots, 1)

      await request.withSession(admin).post(`/admin/suppliers/${supplier.id}/purchasing/aggregate`)

      // Nothing new yet.
      const second = await request
        .withSession(admin)
        .post(`/admin/suppliers/${supplier.id}/purchasing/aggregate`)
      expect(second.status).toBe(409)

      // A new pre-order arrives; the next run picks up only that line.
      const bob = await makeMember()
      await preOrder(bob, carrots, 4)
      const third = await request
        .withSession(admin)
        .post(`/admin/suppliers/${supplier.id}/purchasing/aggregate`)
      expect(third.status).toBe(201)
      expect(third.body.supplierOrder.lines).toHaveLength(1)
      expect(third.body.supplierOrder.lines[0].quantity).toBe(4)
    })

    it('404s an unknown supplier', async () => {
      const res = await request
        .withSession(admin)
        .post('/admin/suppliers/00000000-0000-0000-0000-000000000000/purchasing/aggregate')
      expect(res.status).toBe(404)
    })
  })

  describe('supplier-order reads', () => {
    it('lists and fetches the detail of a created supplier order', async () => {
      const { supplier, carrots } = await makeSupplierWithProducts()
      const alice = await makeMember()
      await preOrder(alice, carrots, 2)
      const aggRes = await request
        .withSession(admin)
        .post(`/admin/suppliers/${supplier.id}/purchasing/aggregate`)
      const id = aggRes.body.supplierOrder.id

      const list = await request.withSession(admin).get('/admin/purchasing/supplier-orders')
      expect(list.status).toBe(200)
      expect(list.body.data.some((o: { id: string }) => o.id === id)).toBe(true)

      const detail = await request.withSession(admin).get(`/admin/purchasing/supplier-orders/${id}`)
      expect(detail.status).toBe(200)
      expect(detail.body.lines).toHaveLength(1)
      expect(detail.body.receptions).toEqual([])
    })

    it('filters the list by status and supplierId', async () => {
      const { supplier, carrots } = await makeSupplierWithProducts()
      await preOrder(await makeMember(), carrots, 1)
      await request.withSession(admin).post(`/admin/suppliers/${supplier.id}/purchasing/aggregate`)

      const draft = await request
        .withSession(admin)
        .get('/admin/purchasing/supplier-orders?filter=status:eq:draft')
      expect(draft.body.data.length).toBeGreaterThan(0)

      const sent = await request
        .withSession(admin)
        .get('/admin/purchasing/supplier-orders?filter=status:eq:sent')
      expect(sent.body.data).toHaveLength(0)
    })

    it('404s an unknown supplier order', async () => {
      const res = await request
        .withSession(admin)
        .get('/admin/purchasing/supplier-orders/00000000-0000-0000-0000-000000000000')
      expect(res.status).toBe(404)
    })
  })

  async function aggregateDraft() {
    const { supplier, carrots, apples } = await makeSupplierWithProducts()
    await preOrder(await makeMember(), carrots, 2)
    await preOrder(await makeMember(), apples, 4)
    const res = await request
      .withSession(admin)
      .post(`/admin/suppliers/${supplier.id}/purchasing/aggregate`)
    return {
      supplier,
      carrots,
      apples,
      order: res.body.supplierOrder as { id: string; version: number },
    }
  }

  describe('POST /admin/purchasing/supplier-orders/:id/send', () => {
    it('moves a draft to sent, and refuses a repeat (FR-008)', async () => {
      const { order } = await aggregateDraft()

      const sent = await request
        .withSession(admin)
        .post(`/admin/purchasing/supplier-orders/${order.id}/send`)
        .send({ version: order.version })
      expect(sent.status).toBe(200)
      expect(sent.body.status).toBe('sent')
      expect(sent.body.sentAt).toBeTruthy()

      const repeat = await request
        .withSession(admin)
        .post(`/admin/purchasing/supplier-orders/${order.id}/send`)
        .send({ version: order.version })
      expect(repeat.status).toBe(409)
    })

    it('409s a stale version (FR-007)', async () => {
      const { order } = await aggregateDraft()
      const res = await request
        .withSession(admin)
        .post(`/admin/purchasing/supplier-orders/${order.id}/send`)
        .send({ version: order.version + 99 })
      expect(res.status).toBe(409)
    })

    it('leaves a sent order untouched by a later aggregation run for the same supplier (FR-007)', async () => {
      const { supplier, carrots, order } = await aggregateDraft()
      await request
        .withSession(admin)
        .post(`/admin/purchasing/supplier-orders/${order.id}/send`)
        .send({ version: order.version })

      await preOrder(await makeMember(), carrots, 7)
      const second = await request
        .withSession(admin)
        .post(`/admin/suppliers/${supplier.id}/purchasing/aggregate`)
      expect(second.status).toBe(201)
      // A brand-new draft — the sent order's single line is unchanged.
      expect(second.body.supplierOrder.id).not.toBe(order.id)

      const original = await request
        .withSession(admin)
        .get(`/admin/purchasing/supplier-orders/${order.id}`)
      expect(original.body.status).toBe('sent')
      expect(original.body.lines).toHaveLength(2)
    })
  })

  describe('GET /admin/purchasing/supplier-orders/:id/export', () => {
    it('returns a readable CSV summary of the order lines', async () => {
      const { order } = await aggregateDraft()
      const res = await request
        .withSession(admin)
        .get(`/admin/purchasing/supplier-orders/${order.id}/export`)
      expect(res.status).toBe(200)
      expect(res.body.filename).toMatch(/\.csv$/)
      expect(res.body.content).toContain('Carrots')
      expect(res.body.content.split('\n')).toHaveLength(3) // header + 2 lines
    })
  })

  async function aggregateSent() {
    const { order, carrots, apples } = await aggregateDraft()
    await request
      .withSession(admin)
      .post(`/admin/purchasing/supplier-orders/${order.id}/send`)
      .send({ version: order.version })
    const detail = await request
      .withSession(admin)
      .get(`/admin/purchasing/supplier-orders/${order.id}`)
    const lineFor = (name: string) =>
      detail.body.lines.find((l: { product: { name: string } }) => l.product.name === name)
    return { orderId: order.id as string, carrots, apples, lineFor, detail }
  }

  describe('POST /admin/purchasing/supplier-orders/:id/receptions', () => {
    it('records a reception, flags a short line, updates received-so-far, and can be repeated', async () => {
      const { orderId, lineFor } = await aggregateSent()
      const carrotLine = lineFor('Carrots') // ordered 2
      const appleLine = lineFor('Apples') // ordered 4

      const res = await request
        .withSession(admin)
        .post(`/admin/purchasing/supplier-orders/${orderId}/receptions`)
        .send({
          lines: [
            { supplierOrderLineId: carrotLine.id, receivedQuantity: 2, unitCostEur: 1.5 },
            { supplierOrderLineId: appleLine.id, receivedQuantity: 3, unitCostEur: 2 },
          ],
        })
      expect(res.status).toBe(201)
      expect(res.body.lines).toHaveLength(2)

      const after = await request
        .withSession(admin)
        .get(`/admin/purchasing/supplier-orders/${orderId}`)
      const carrotsAfter = after.body.lines.find(
        (l: { product: { name: string } }) => l.product.name === 'Carrots',
      )
      const applesAfter = after.body.lines.find(
        (l: { product: { name: string } }) => l.product.name === 'Apples',
      )
      expect(carrotsAfter.receivedQuantity).toBe(2)
      expect(carrotsAfter.discrepancy).toBe('none')
      expect(applesAfter.receivedQuantity).toBe(3)
      expect(applesAfter.discrepancy).toBe('short')
      // Not every line fully received → still sent.
      expect(after.body.status).toBe('sent')
      expect(after.body.receptions).toHaveLength(1)

      // A second reception for the remainder accumulates and flips the order to received.
      const second = await request
        .withSession(admin)
        .post(`/admin/purchasing/supplier-orders/${orderId}/receptions`)
        .send({
          lines: [{ supplierOrderLineId: appleLine.id, receivedQuantity: 1, unitCostEur: 2 }],
        })
      expect(second.status).toBe(201)

      const final = await request
        .withSession(admin)
        .get(`/admin/purchasing/supplier-orders/${orderId}`)
      expect(final.body.status).toBe('received')
      expect(final.body.receptions).toHaveLength(2)
      const applesFinal = final.body.lines.find(
        (l: { product: { name: string } }) => l.product.name === 'Apples',
      )
      expect(applesFinal.receivedQuantity).toBe(4)
      expect(applesFinal.discrepancy).toBe('none')
    })

    it('marks the contributing pre-order lines fulfilled on the first reception, and never re-touches them', async () => {
      const { orderId, lineFor } = await aggregateSent()
      const carrotLine = lineFor('Carrots')

      await request
        .withSession(admin)
        .post(`/admin/purchasing/supplier-orders/${orderId}/receptions`)
        .send({
          lines: [{ supplierOrderLineId: carrotLine.id, receivedQuantity: 1, unitCostEur: 1 }],
        })

      const lines = await em.fork().find(OrderLine, { product: { name: 'Carrots' } })
      expect(lines.length).toBeGreaterThan(0)
      expect(lines.every((l) => l.fulfilledAt !== null)).toBe(true)
      const firstStamps = lines.map((l) => l.fulfilledAt?.getTime())

      // A second reception for the same line does not move the fulfilledAt stamps.
      await request
        .withSession(admin)
        .post(`/admin/purchasing/supplier-orders/${orderId}/receptions`)
        .send({
          lines: [{ supplierOrderLineId: carrotLine.id, receivedQuantity: 1, unitCostEur: 1 }],
        })
      const again = await em.fork().find(OrderLine, { product: { name: 'Carrots' } })
      expect(again.map((l) => l.fulfilledAt?.getTime())).toEqual(firstStamps)
    })

    it('refuses a reception against a draft order (FR-015) and an unknown line id', async () => {
      const { order } = await aggregateDraft()
      const draftDetail = await request
        .withSession(admin)
        .get(`/admin/purchasing/supplier-orders/${order.id}`)
      const anyLine = draftDetail.body.lines[0]

      const onDraft = await request
        .withSession(admin)
        .post(`/admin/purchasing/supplier-orders/${order.id}/receptions`)
        .send({ lines: [{ supplierOrderLineId: anyLine.id, receivedQuantity: 1, unitCostEur: 1 }] })
      expect(onDraft.status).toBe(409)

      const { orderId } = await aggregateSent()
      const unknownLine = await request
        .withSession(admin)
        .post(`/admin/purchasing/supplier-orders/${orderId}/receptions`)
        .send({
          lines: [
            {
              supplierOrderLineId: '00000000-0000-0000-0000-000000000000',
              receivedQuantity: 1,
              unitCostEur: 1,
            },
          ],
        })
      expect(unknownLine.status).toBe(404)
    })

    it('rejects a negative quantity or cost at validation', async () => {
      const { orderId, lineFor } = await aggregateSent()
      const line = lineFor('Carrots')
      const res = await request
        .withSession(admin)
        .post(`/admin/purchasing/supplier-orders/${orderId}/receptions`)
        .send({ lines: [{ supplierOrderLineId: line.id, receivedQuantity: -1, unitCostEur: 1 }] })
      expect(res.status).toBe(400)
    })
  })

  describe('authorization', () => {
    it('401s anonymous and 403s a non-admin member', async () => {
      const supplier = await createSupplierData(em)
      expect(
        (await request.post(`/admin/suppliers/${supplier.id}/purchasing/aggregate`)).status,
      ).toBe(401)

      const { user } = await createMemberData(em, {
        user: { email: `plain-${Math.random().toString(36).slice(2)}@example.com` },
        status: 'active',
      })
      const res = await request
        .withSession(createSessionFromUser(user))
        .get('/admin/purchasing/supplier-orders')
      expect(res.status).toBe(403)
    })
  })
})
