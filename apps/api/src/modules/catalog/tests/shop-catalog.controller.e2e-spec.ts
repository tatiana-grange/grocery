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
    const { orm, app } = await initializeTestApp({ orm: context.orm }, { imports: [CatalogModule] })
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

  async function makeCategory(name = 'Légumes', parentId?: string) {
    const res = await request.withSession(admin).post('/admin/categories').send({ name, parentId })
    return res.body as { id: string }
  }

  async function makeProductIn(categoryId: string, name: string) {
    const supplier = await makeSupplier(`S-${Math.random().toString(36).slice(2, 6)}`)
    const res = await request.withSession(admin).post('/admin/products').send({
      name,
      supplierId: supplier.id,
      categoryId,
      saleMode: 'unit',
      orderingMode: 'in_store',
      initialPriceEur: 1,
    })
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

  it('surfaces a parent category via its children and carries parentId + productCount', async () => {
    const parent = await makeCategory(`Crèmerie-${Math.random().toString(36).slice(2, 6)}`)
    const child = await makeCategory(
      `Fromages-${Math.random().toString(36).slice(2, 6)}`,
      parent.id,
    )
    await makeProductIn(parent.id, 'Lait entier')
    await makeProductIn(child.id, 'Comté')
    await makeProductIn(child.id, 'Brie')

    const res = await request.get('/shop/categories')
    expect(res.status).toBe(200)
    const byId = new Map<string, { parentId: string | null; productCount: number }>(
      res.body.map((c: { id: string; parentId: string | null; productCount: number }) => [c.id, c]),
    )
    // The parent shows even though most of its products sit under the child.
    expect(byId.get(parent.id)).toEqual({
      id: parent.id,
      name: expect.any(String),
      parentId: null,
      productCount: 1,
    })
    expect(byId.get(child.id)).toMatchObject({ parentId: parent.id, productCount: 2 })
  })

  it('filtering by a parent category returns its own products and its children’s', async () => {
    const parent = await makeCategory(`Boucherie-${Math.random().toString(36).slice(2, 6)}`)
    const child = await makeCategory(
      `Volaille-${Math.random().toString(36).slice(2, 6)}`,
      parent.id,
    )
    const own = await makeProductIn(parent.id, 'Steak haché')
    const nested = await makeProductIn(child.id, 'Cuisse de poulet')
    const elsewhere = await makeProductIn((await makeCategory('Ailleurs')).id, 'Savon')

    const res = await request.get(`/shop/products?filter=categoryId:eq:${parent.id}`)
    expect(res.status).toBe(200)
    const ids = res.body.data.map((p: { id: string }) => p.id)
    expect(ids).toEqual(expect.arrayContaining([own.id, nested.id]))
    expect(ids).not.toContain(elsewhere.id)

    // A leaf category still filters to exactly itself.
    const leaf = await request.get(`/shop/products?filter=categoryId:eq:${child.id}`)
    expect(leaf.body.data.map((p: { id: string }) => p.id)).toEqual([nested.id])
  })

  it('combines a category filter with a search query', async () => {
    const parent = await makeCategory(`Épicerie-${Math.random().toString(36).slice(2, 6)}`)
    const child = await makeCategory(`Pâtes-${Math.random().toString(36).slice(2, 6)}`, parent.id)
    const match = await makeProductIn(child.id, 'Tagliatelles fraîches')
    await makeProductIn(child.id, 'Penne')

    const res = await request.get(
      `/shop/products?filter=categoryId:eq:${parent.id};q:like:Tagliatelles`,
    )
    expect(res.status).toBe(200)
    expect(res.body.data.map((p: { id: string }) => p.id)).toEqual([match.id])
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

  it('defaults the by-weight quantity picker to 100 g steps shown in kilograms', async () => {
    const { product } = await makeProduct({ name: 'Farine T65', saleMode: 'weight' })

    const res = await request.get(`/shop/products/${product.id}`)
    expect(res.body).toMatchObject({ selectionUnit: 'kg', quantityStepGrams: 100 })
  })

  it('carries a product-specific selection unit and step to the shop', async () => {
    const { product } = await makeProduct({
      name: 'Comté à la coupe',
      saleMode: 'weight',
      selectionUnit: 'g',
      quantityStepGrams: 250,
    })

    const res = await request.get(`/shop/products/${product.id}`)
    expect(res.body).toMatchObject({ selectionUnit: 'g', quantityStepGrams: 250 })
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
