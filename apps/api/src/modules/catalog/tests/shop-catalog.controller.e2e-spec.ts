import type { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it } from 'vitest'
/**
 * E2E tests for the public shop catalogue endpoints (`@Public()`, no `Authorization` header
 * required on any route).
 */
import { initializeTestApp } from '../../../test/helpers/test-app.helper'
import {
  createRequest,
  createSessionFromUser,
  type TestRequest,
} from '../../../test/helpers/test-auth.helper'
import { createMemberData } from '../../members/members.factory'
import { CatalogModule } from '../catalog.module'

describe('shopCatalogController (e2e)', () => {
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
    return res.body as { id: string }
  }

  async function makeCategory(name = 'Légumes') {
    const res = await request.withSession(admin).post('/admin/categories').send({ name })
    return res.body as { id: string }
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
        orderingMode: 'in_store',
        initialPriceEur: 1.5,
        ...overrides,
      })
    return { product: res.body, supplier, category }
  }

  it('excludes a category whose only product is archived', async () => {
    const { product, category } = await makeProduct({ name: 'Farine' })
    const before = await request.get('/shop/categories')
    expect(before.body.some((c: { id: string }) => c.id === category.id)).toBe(true)

    await request.withSession(admin).post(`/admin/products/${product.id}/archive`)

    const after = await request.get('/shop/categories')
    expect(after.status).toBe(200)
    expect(after.body.some((c: { id: string }) => c.id === category.id)).toBe(false)
  })

  it('lists only non-archived products and supports search by name and barcode', async () => {
    const { product } = await makeProduct({ name: 'Pommes Golden', barcode: '1234567890123' })
    const { product: other } = await makeProduct({ name: 'Poires' })
    await request.withSession(admin).post(`/admin/products/${other.id}/archive`)

    const list = await request.get('/shop/products')
    expect(list.status).toBe(200)
    expect(list.body.data.find((p: { id: string }) => p.id === other.id)).toBeUndefined()
    expect(list.body.data.find((p: { id: string }) => p.id === product.id)).toBeDefined()

    const byName = await request.get('/shop/products?filter=q:like:Pommes')
    expect(byName.body.data.map((p: { id: string }) => p.id)).toContain(product.id)

    const byBarcode = await request.get('/shop/products?filter=q:like:1234567890123')
    expect(byBarcode.body.data.map((p: { id: string }) => p.id)).toContain(product.id)
  })

  it('sorts the product list by name', async () => {
    await makeProduct({ name: 'Zucchini' })
    await makeProduct({ name: 'Abricots' })

    const res = await request.get('/shop/products?sort=name:asc')
    expect(res.status).toBe(200)
    const names = res.body.data.map((p: { name: string }) => p.name)
    expect(names.indexOf('Abricots')).toBeLessThan(names.indexOf('Zucchini'))
  })

  it('returns photos, description, current price, sale unit, labels and ordering mode on detail', async () => {
    const { product } = await makeProduct({
      name: 'Carottes en vrac',
      saleMode: 'weight',
      orderingMode: 'both',
      initialPriceEur: 2.1,
      description: 'Carottes bio',
      labels: ['organic'],
      photos: ['photo.jpg'],
    })

    const res = await request.get(`/shop/products/${product.id}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      name: 'Carottes en vrac',
      description: 'Carottes bio',
      saleMode: 'weight',
      pricingUnit: 'kg',
      currentPriceEur: 2.1,
      labels: ['organic'],
      photos: ['photo.jpg'],
      orderingMode: 'both',
    })
    expect(res.body.version).toBeUndefined()
    expect(res.body.priceHistory).toBeUndefined()
  })

  it('404s on an archived or unknown product id', async () => {
    const { product } = await makeProduct()
    await request.withSession(admin).post(`/admin/products/${product.id}/archive`)

    expect((await request.get(`/shop/products/${product.id}`)).status).toBe(404)
    expect((await request.get('/shop/products/00000000-0000-0000-0000-000000000000')).status).toBe(
      404,
    )
  })

  it('every shop route is reachable with no Authorization header', async () => {
    const { product } = await makeProduct()

    expect((await request.get('/shop/categories')).status).toBe(200)
    expect((await request.get('/shop/products')).status).toBe(200)
    expect((await request.get(`/shop/products/${product.id}`)).status).toBe(200)
  })
})
