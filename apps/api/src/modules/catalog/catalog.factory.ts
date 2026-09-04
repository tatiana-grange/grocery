import type { EntityManager } from '@mikro-orm/core'
import type { ProductOrderingMode, ProductSaleMode } from './contracts/product.contract'
import type { SupplierType } from './contracts/supplier.contract'
import { User } from '../auth/auth.entity'
import { createUserData } from '../auth/auth.factory'
import { eurToCents } from './catalog.util'
import { Category } from './entities/category.entity'
import { ProductPrice } from './entities/product-price.entity'
import { Product } from './entities/product.entity'
import { Supplier } from './entities/supplier.entity'

export async function createSupplierData(
  em: EntityManager,
  overrides: Partial<Pick<Supplier, 'name' | 'type' | 'archivedAt'>> = {},
): Promise<Supplier> {
  const supplier = new Supplier()
  supplier.name = overrides.name ?? `Supplier ${Math.random().toString(36).slice(2, 7)}`
  supplier.type = (overrides.type ?? 'producer') as SupplierType
  if (overrides.archivedAt) supplier.archivedAt = overrides.archivedAt
  await em.persist(supplier).flush()
  return supplier
}

export async function createCategoryData(
  em: EntityManager,
  overrides: Partial<Pick<Category, 'name' | 'archivedAt'>> = {},
): Promise<Category> {
  const category = new Category()
  category.name = overrides.name ?? `Category ${Math.random().toString(36).slice(2, 7)}`
  if (overrides.archivedAt) category.archivedAt = overrides.archivedAt
  await em.persist(category).flush()
  return category
}

export interface CreateProductOptions {
  name?: string
  saleMode?: ProductSaleMode
  orderingMode?: ProductOrderingMode
  priceEur?: number
  supplier?: Supplier
  category?: Category
  setByUser?: User
  archivedAt?: Date
}

export async function createProductData(
  em: EntityManager,
  options: CreateProductOptions = {},
): Promise<{ product: Product; price: ProductPrice }> {
  const supplier = options.supplier ?? (await createSupplierData(em))
  const category = options.category ?? (await createCategoryData(em))
  const setByUser =
    options.setByUser ??
    (await em.find(User, {}, { limit: 1 }))[0] ??
    (await createUserData(em))

  const product = new Product()
  product.name = options.name ?? `Product ${Math.random().toString(36).slice(2, 7)}`
  product.supplier = supplier
  product.category = category
  product.saleMode = options.saleMode ?? 'unit'
  product.orderingMode = options.orderingMode ?? 'in_store'

  const price = new ProductPrice()
  price.product = product
  price.amountCents = eurToCents(options.priceEur ?? 1.5)
  price.validFrom = new Date()
  price.setByUser = setByUser
  product.prices.add(price)
  if (options.archivedAt) product.archivedAt = options.archivedAt

  await em.persist([product, price]).flush()
  return { product, price }
}
