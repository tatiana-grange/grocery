import type { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it } from 'vitest'
/**
 * E2E tests for the back-office catalogue endpoints (all @AdminOnly()).
 */
import { initializeTestApp } from '../../../test/helpers/test-app.helper'
import {
  createRequest,
  createSessionFromUser,
  type TestRequest,
} from '../../../test/helpers/test-auth.helper'
import { createMemberData } from '../../members/members.factory'
import { CatalogModule } from '../catalog.module'

describe('catalogController (e2e)', () => {
  let request: TestRequest
  let admin: ReturnType<typeof createSessionFromUser>

  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      { imports: [CatalogModule] },
    )
    context.app = app
    const em: EntityManager = orm.em.fork()
    request = createRequest(app)
    const { user } = await createMemberData(em, {
      user: { name: 'Admin', email: `admin-${Math.random().toString(36).slice(2)}@example.com` },
      roles: ['member', 'admin'],
      status: 'active',
    })
    admin = createSessionFromUser(user)
  })

  async function makeSupplier(name = 'Ferme') {
    const res = await request
      .withSession(admin)
      .post('/admin/suppliers')
      .send({ name, type: 'producer' })
    return res.body as { id: string; version: number }
  }

  async function makeCategory(name = 'Légumes') {
    const res = await request
      .withSession(admin)
      .post('/admin/categories')
      .send({ name })
    return res.body as { id: string; version: number }
  }

  async function makeProduct(overrides: Record<string, unknown> = {}) {
    const supplier = await makeSupplier(`S-${Math.random().toString(36).slice(2, 6)}`)
    const category = await makeCategory(`C-${Math.random().toString(36).slice(2, 6)}`)
    const res = await request
      .withSession(admin)
      .post('/admin/products')
      .send({
        name: 'Carrots',
        supplierId: supplier.id,
        categoryId: category.id,
        saleMode: 'unit',
        initialPriceEur: 1.5,
        ...overrides,
      })
    return { product: res.body, supplier, category }
  }

  it('creates a by-weight product priced per kg', async () => {
    const { product } = await makeProduct({ saleMode: 'weight', initialPriceEur: 2.4 })
    expect(product).toMatchObject({ saleMode: 'weight', pricingUnit: 'kg', currentPriceEur: 2.4 })
    expect(product.priceHistory).toHaveLength(1)
  })

  it('keeps a windowed price history across changes', async () => {
    const { product } = await makeProduct()
    await request
      .withSession(admin)
      .post(`/admin/products/${product.id}/price`)
      .send({ amountEur: 1.8 })
    const res = await request
      .withSession(admin)
      .post(`/admin/products/${product.id}/price`)
      .send({ amountEur: 2 })

    expect(res.status).toBe(200)
    expect(res.body.currentPriceEur).toBe(2)
    expect(res.body.priceHistory).toHaveLength(3)
    const open = res.body.priceHistory.filter((w: { validTo: string | null }) => !w.validTo)
    expect(open).toHaveLength(1)
  })

  it('archives a product: gone from the list, still on detail', async () => {
    const { product } = await makeProduct()
    await request.withSession(admin).post(`/admin/products/${product.id}/archive`)

    const list = await request.withSession(admin).get('/admin/products')
    expect(list.body.data.find((p: { id: string }) => p.id === product.id)).toBeUndefined()

    const withArchived = await request
      .withSession(admin)
      .get('/admin/products?includeArchived=true')
    expect(withArchived.body.data.find((p: { id: string }) => p.id === product.id)).toBeDefined()

    const detail = await request.withSession(admin).get(`/admin/products/${product.id}`)
    expect(detail.status).toBe(200)
    expect(detail.body.archivedAt).toBeTruthy()
  })

  it('blocks archiving a supplier with active products unless cascade', async () => {
    const { product, supplier } = await makeProduct()

    const blocked = await request
      .withSession(admin)
      .post(`/admin/suppliers/${supplier.id}/archive`)
    expect(blocked.status).toBe(409)
    expect(blocked.body.activeProductCount).toBe(1)

    const cascaded = await request
      .withSession(admin)
      .post(`/admin/suppliers/${supplier.id}/archive?cascade=true`)
    expect(cascaded.status).toBe(200)

    const detail = await request.withSession(admin).get(`/admin/products/${product.id}`)
    expect(detail.body.archivedAt).toBeTruthy()
  })

  it('blocks archiving a category referenced by an active product', async () => {
    const { category } = await makeProduct()
    const res = await request
      .withSession(admin)
      .post(`/admin/categories/${category.id}/archive`)
    expect(res.status).toBe(409)
    expect(res.body.productCount).toBe(1)
  })

  it('returns 409 on a stale version', async () => {
    const supplier = await makeSupplier()
    const res = await request
      .withSession(admin)
      .put(`/admin/suppliers/${supplier.id}`)
      .send({ name: 'Renamed', version: supplier.version + 5 })
    expect(res.status).toBe(409)
  })

  it('rejects a plain member and unauthenticated callers', async (context) => {
    const em: EntityManager = context.orm.em.fork()
    const { user: plain } = await createMemberData(em, { roles: ['member'], status: 'active' })

    expect((await request.get('/admin/suppliers')).status).toBe(401)
    expect(
      (await request.withSession(createSessionFromUser(plain)).get('/admin/suppliers')).status,
    ).toBe(403)
  })
})
