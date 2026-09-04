import type { FilterQuery } from '@mikro-orm/core'
import {
  EntityManager,
  LockMode,
  QueryOrder,
  UniqueConstraintViolationException,
  wrap,
} from '@mikro-orm/core'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { User } from '../auth/auth.entity'
import { eurToCents } from './catalog.util'
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from './contracts/category.contract'
import type { SetProductPriceInput } from './contracts/product-price.contract'
import type {
  CreateProductInput,
  ProductFiltering,
  ProductPagination,
  ProductSorting,
  UpdateProductInput,
} from './contracts/product.contract'
import type {
  CreateSupplierInput,
  SupplierFiltering,
  SupplierPagination,
  UpdateSupplierInput,
} from './contracts/supplier.contract'
import { Category } from './entities/category.entity'
import { ProductPrice } from './entities/product-price.entity'
import { Product } from './entities/product.entity'
import { Supplier } from './entities/supplier.entity'

interface ListOptions {
  includeArchived?: boolean
}

export interface ProductsListResult {
  products: Product[]
  total: number
  pagination: ProductPagination
}

@Injectable()
export class CatalogService {
  constructor(private readonly em: EntityManager) {}

  // ============================================================================================
  // Suppliers
  // ============================================================================================

  async listSuppliers(
    pagination: SupplierPagination,
    filter?: SupplierFiltering,
    options: ListOptions = {},
  ): Promise<{ suppliers: Supplier[]; total: number; pagination: SupplierPagination }> {
    const where: FilterQuery<Supplier> = options.includeArchived ? {} : { archivedAt: null }
    for (const item of filter ?? []) {
      if (item.property === 'type') Object.assign(where, { type: item.value })
      if (item.property === 'q') {
        Object.assign(where, { name: { $like: `%${item.value}%` } })
      }
    }

    const [suppliers, total] = await this.em.findAndCount(Supplier, where, {
      orderBy: { name: QueryOrder.ASC },
      limit: pagination.pageSize,
      offset: pagination.offset,
    })
    return { suppliers, total, pagination }
  }

  async getSupplier(id: string): Promise<Supplier> {
    const supplier = await this.em.findOne(Supplier, { id })
    if (!supplier) throw new NotFoundException('Supplier not found')
    return supplier
  }

  async createSupplier(input: CreateSupplierInput): Promise<Supplier> {
    const supplier = new Supplier()
    wrap(supplier).assign(this.stripNullish(input))
    this.em.persist(supplier)
    await this.em.flush()
    return supplier
  }

  async updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier> {
    const supplier = await this.getSupplier(id)
    this.assertVersion(supplier.version, input.version)
    const { version: _version, ...rest } = input
    wrap(supplier).assign(this.stripNullish(rest))
    await this.em.flush()
    return supplier
  }

  async archiveSupplier(id: string, cascade: boolean): Promise<Supplier> {
    return this.em.transactional(async (em) => {
      const supplier = await em.findOne(Supplier, { id }, { populate: ['products'] })
      if (!supplier) throw new NotFoundException('Supplier not found')

      const activeProducts = supplier.products.getItems().filter((p) => !p.archivedAt)
      if (activeProducts.length > 0 && !cascade) {
        throw new ConflictException({
          message: 'This supplier still has active products',
          activeProductCount: activeProducts.length,
        })
      }

      const now = new Date()
      supplier.archivedAt = now
      for (const product of activeProducts) product.archivedAt = now
      await em.flush()
      return supplier
    })
  }

  async unarchiveSupplier(id: string): Promise<Supplier> {
    const supplier = await this.getSupplier(id)
    supplier.archivedAt = undefined
    await this.em.flush()
    return supplier
  }

  // ============================================================================================
  // Categories
  // ============================================================================================

  async listCategories(options: ListOptions = {}): Promise<Category[]> {
    const where: FilterQuery<Category> = options.includeArchived ? {} : { archivedAt: null }
    return this.em.find(Category, where, { orderBy: { name: QueryOrder.ASC } })
  }

  async getCategory(id: string): Promise<Category> {
    const category = await this.em.findOne(Category, { id })
    if (!category) throw new NotFoundException('Category not found')
    return category
  }

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const category = new Category()
    category.name = input.name
    if (input.parentId) {
      category.parent = await this.resolveParent(null, input.parentId)
    }
    this.em.persist(category)
    await this.em.flush()
    return category
  }

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
    const category = await this.getCategory(id)
    this.assertVersion(category.version, input.version)
    if (input.name !== undefined) category.name = input.name
    if (input.parentId !== undefined) {
      category.parent = input.parentId
        ? await this.resolveParent(id, input.parentId)
        : undefined
    }
    await this.em.flush()
    return category
  }

  /**
   * Validates a proposed parent against the "one nesting level" rule: a category cannot be its
   * own parent, the parent must exist and must itself be top-level, and a category that already
   * has sub-categories cannot become a sub-category.
   */
  private async resolveParent(categoryId: string | null, parentId: string): Promise<Category> {
    if (categoryId && parentId === categoryId) {
      throw new ConflictException('A category cannot be its own parent')
    }
    const parent = await this.em.findOne(Category, { id: parentId })
    if (!parent) throw new NotFoundException('Parent category not found')
    if (parent.parent) {
      throw new ConflictException('Categories can only be nested one level deep')
    }
    if (categoryId) {
      const childCount = await this.em.count(Category, { parent: categoryId })
      if (childCount > 0) {
        throw new ConflictException(
          'This category has sub-categories, so it cannot become a sub-category itself',
        )
      }
    }
    return parent
  }

  async archiveCategory(id: string): Promise<Category> {
    const category = await this.getCategory(id)
    const activeProducts = await this.em.count(Product, { category: id, archivedAt: null })
    if (activeProducts > 0) {
      throw new ConflictException({
        message: 'Reassign this category’s active products before removing it',
        productCount: activeProducts,
      })
    }
    category.archivedAt = new Date()
    await this.em.flush()
    return category
  }

  async unarchiveCategory(id: string): Promise<Category> {
    const category = await this.getCategory(id)
    category.archivedAt = undefined
    await this.em.flush()
    return category
  }

  async productCountFor(categoryIds: string[]): Promise<Map<string, number>> {
    return this.countActiveProductsBy('category', categoryIds)
  }

  async productCountForSuppliers(supplierIds: string[]): Promise<Map<string, number>> {
    return this.countActiveProductsBy('supplier', supplierIds)
  }

  private async countActiveProductsBy(
    field: 'category' | 'supplier',
    ids: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>()
    if (ids.length === 0) return result
    const rows = await this.em.find(
      Product,
      { [field]: { $in: ids }, archivedAt: null } as FilterQuery<Product>,
      { fields: [field] },
    )
    for (const row of rows) {
      const key = (row[field] as { id: string }).id
      result.set(key, (result.get(key) ?? 0) + 1)
    }
    return result
  }

  // ============================================================================================
  // Products
  // ============================================================================================

  async listProducts(
    pagination: ProductPagination,
    sort?: ProductSorting,
    filter?: ProductFiltering,
    options: ListOptions = {},
  ): Promise<ProductsListResult> {
    const where: FilterQuery<Product> = options.includeArchived ? {} : { archivedAt: null }
    for (const item of filter ?? []) {
      if (item.property === 'supplierId') Object.assign(where, { supplier: item.value })
      if (item.property === 'categoryId') Object.assign(where, { category: item.value })
      if (item.property === 'saleMode') Object.assign(where, { saleMode: item.value })
      if (item.property === 'label') Object.assign(where, { labels: { $contains: [item.value] } })
      if (item.property === 'q') {
        Object.assign(where, {
          $or: [{ name: { $like: `%${item.value}%` } }, { barcode: { $like: `%${item.value}%` } }],
        })
      }
    }

    const sortItem = sort?.[0]
    const direction =
      sortItem && String(sortItem.direction).toUpperCase() === 'ASC'
        ? QueryOrder.ASC
        : QueryOrder.DESC
    const orderBy = sortItem?.property === 'name' ? { name: direction } : { createdAt: direction }

    const [products, total] = await this.em.findAndCount(Product, where, {
      populate: ['supplier', 'category', 'prices'],
      orderBy,
      limit: pagination.pageSize,
      offset: pagination.offset,
    })
    return { products, total, pagination }
  }

  async getProductDetail(id: string): Promise<Product> {
    const product = await this.em.findOne(
      Product,
      { id },
      { populate: ['supplier', 'category', 'prices', 'prices.setByUser'] },
    )
    if (!product) throw new NotFoundException('Product not found')
    return product
  }

  async createProduct(input: CreateProductInput, userId: string): Promise<Product> {
    return this.em.transactional(async (em) => {
      const product = new Product()
      product.name = input.name
      product.description = input.description ?? undefined
      product.supplier = em.getReference(Supplier, input.supplierId)
      product.category = em.getReference(Category, input.categoryId)
      product.saleMode = input.saleMode
      product.orderingMode = input.orderingMode
      product.photos = input.photos ?? []
      product.labels = input.labels ?? []
      product.barcode = input.barcode ?? undefined
      product.averageWeightGrams = input.averageWeightGrams ?? undefined
      product.weightTolerancePercent = input.weightTolerancePercent ?? undefined

      const price = new ProductPrice()
      price.product = product
      price.amountCents = eurToCents(input.initialPriceEur)
      price.validFrom = new Date()
      price.setByUser = em.getReference(User, userId)
      product.prices.add(price)

      em.persist([product, price])
      return product
    })
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
    const product = await this.getProductDetail(id)
    this.assertVersion(product.version, input.version)

    if (input.name !== undefined) product.name = input.name
    if (input.description !== undefined) product.description = input.description ?? undefined
    if (input.saleMode !== undefined && input.saleMode !== product.saleMode) {
      const hasOpenPrice = product.prices.getItems().some((price) => !price.validTo)
      if (hasOpenPrice) {
        throw new ConflictException(
          'Changing the sale mode changes what the price means — set a new price with the price endpoint at the same time',
        )
      }
      product.saleMode = input.saleMode
    }
    if (input.orderingMode !== undefined) product.orderingMode = input.orderingMode
    if (input.photos !== undefined) product.photos = input.photos
    if (input.labels !== undefined) product.labels = input.labels
    if (input.barcode !== undefined) product.barcode = input.barcode ?? undefined
    if (input.averageWeightGrams !== undefined) {
      product.averageWeightGrams = input.averageWeightGrams ?? undefined
    }
    if (input.weightTolerancePercent !== undefined) {
      product.weightTolerancePercent = input.weightTolerancePercent ?? undefined
    }
    if (input.supplierId !== undefined) {
      product.supplier = this.em.getReference(Supplier, input.supplierId)
    }
    if (input.categoryId !== undefined) {
      product.category = this.em.getReference(Category, input.categoryId)
    }

    await this.em.flush()
    return product
  }

  async setProductPrice(
    id: string,
    input: SetProductPriceInput,
    userId: string,
  ): Promise<Product> {
    return this.em.transactional(async (em) => {
      // Lock the product row so two concurrent price changes serialise: without this both
      // readers see the same open row, both close it, and both insert a new open row —
      // leaving two rows with `validTo IS NULL` and a corrupt "current price".
      const product = await em.findOne(Product, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!product) throw new NotFoundException('Product not found')
      await em.populate(product, ['prices'])

      const effectiveFrom = input.effectiveFrom ?? new Date()
      const current = product.prices.getItems().find((price) => !price.validTo)
      if (current) {
        if (effectiveFrom < current.validFrom) {
          throw new ConflictException(
            'The new price cannot start before the current price began',
          )
        }
        current.validTo = effectiveFrom
        // Close the open row before inserting its replacement: the partial unique index
        // ("one open price per product") is checked per statement, not deferred.
        await em.flush()
      }

      const next = new ProductPrice()
      next.product = product
      next.amountCents = eurToCents(input.amountEur)
      next.validFrom = effectiveFrom
      next.setByUser = em.getReference(User, userId)
      product.prices.add(next)
      em.persist(next)

      try {
        await em.flush()
      } catch (error) {
        if (error instanceof UniqueConstraintViolationException) {
          throw new ConflictException(
            'This product’s price just changed — reload and try again',
          )
        }
        throw error
      }
      return product
    })
  }

  async archiveProduct(id: string): Promise<Product> {
    const product = await this.em.findOne(Product, { id })
    if (!product) throw new NotFoundException('Product not found')
    product.archivedAt = new Date()
    await this.em.flush()
    return product
  }

  async unarchiveProduct(id: string): Promise<Product> {
    const product = await this.em.findOne(
      Product,
      { id },
      { populate: ['supplier', 'category'] },
    )
    if (!product) throw new NotFoundException('Product not found')

    if (product.supplier.archivedAt) {
      throw new ConflictException('Unarchive the supplier first')
    }
    if (product.category.archivedAt) {
      throw new ConflictException('Unarchive the category first')
    }
    product.archivedAt = undefined
    await this.em.flush()
    return product
  }

  // ============================================================================================
  // Helpers
  // ============================================================================================

  private assertVersion(actual: number, sent: number): void {
    if (actual !== sent) {
      throw new ConflictException('This record changed since you opened it — reload and try again')
    }
  }

  private stripNullish<T extends Record<string, unknown>>(input: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== null && value !== undefined),
    ) as Partial<T>
  }
}
