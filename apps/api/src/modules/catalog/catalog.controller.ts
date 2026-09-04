import {
  FilteringParams,
  PaginationParams,
  SortingParams,
  TypedBody,
  TypedController,
  TypedParam,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { HttpCode, Query, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { AdminOnly, Session } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import { CatalogMapper } from './catalog.mapper'
import { CatalogService } from './catalog.service'
import {
  categoriesListSchema,
  categorySchema,
  type CreateCategoryInput,
  createCategorySchema,
  type UpdateCategoryInput,
  updateCategorySchema,
} from './contracts/category.contract'
import {
  type SetProductPriceInput,
  setProductPriceSchema,
} from './contracts/product-price.contract'
import {
  type CreateProductInput,
  createProductSchema,
  type ProductFiltering,
  productDetailSchema,
  productFilteringSchema,
  type ProductPagination,
  productPaginationSchema,
  productSchema,
  type ProductSorting,
  productSortingSchema,
  productsListSchema,
  type UpdateProductInput,
  updateProductSchema,
} from './contracts/product.contract'
import {
  type CreateSupplierInput,
  createSupplierSchema,
  type SupplierFiltering,
  supplierFilteringSchema,
  type SupplierPagination,
  supplierPaginationSchema,
  supplierSchema,
  suppliersListSchema,
  type UpdateSupplierInput,
  updateSupplierSchema,
} from './contracts/supplier.contract'

const isTrue = (value?: string): boolean => value === 'true' || value === '1'

@TypedController('admin/suppliers', undefined, { tags: ['Admin Catalog'] })
@UseGuards(AuthGuard)
@AdminOnly()
export class AdminSuppliersController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly mapper: CatalogMapper,
  ) {}

  @TypedRoute.Get('', suppliersListSchema)
  async list(
    @PaginationParams(supplierPaginationSchema) pagination: SupplierPagination,
    @FilteringParams(supplierFilteringSchema) filter?: SupplierFiltering,
    @Query('includeArchived') includeArchived?: string,
  ) {
    const result = await this.catalog.listSuppliers(pagination, filter, {
      includeArchived: isTrue(includeArchived),
    })
    const counts = await this.catalog.productCountForSuppliers(result.suppliers.map((s) => s.id))
    return this.mapper.toSuppliersList(result.suppliers, result.total, pagination, counts)
  }

  @TypedRoute.Get(':id', supplierSchema)
  async get(@TypedParam('id', z.string()) id: string) {
    const supplier = await this.catalog.getSupplier(id)
    const counts = await this.catalog.productCountForSuppliers([supplier.id])
    return this.mapper.toSupplier(supplier, counts.get(supplier.id) ?? 0)
  }

  @TypedRoute.Post('', supplierSchema)
  async create(@TypedBody(createSupplierSchema) body: CreateSupplierInput) {
    const supplier = await this.catalog.createSupplier(body)
    return this.mapper.toSupplier(supplier, 0)
  }

  @TypedRoute.Put(':id', supplierSchema)
  async update(
    @TypedParam('id', z.string()) id: string,
    @TypedBody(updateSupplierSchema) body: UpdateSupplierInput,
  ) {
    const supplier = await this.catalog.updateSupplier(id, body)
    const counts = await this.catalog.productCountForSuppliers([supplier.id])
    return this.mapper.toSupplier(supplier, counts.get(supplier.id) ?? 0)
  }

  @TypedRoute.Post(':id/archive', supplierSchema)
  @HttpCode(200)
  async archive(
    @TypedParam('id', z.string()) id: string,
    @Query('cascade') cascade?: string,
  ) {
    const supplier = await this.catalog.archiveSupplier(id, isTrue(cascade))
    const counts = await this.catalog.productCountForSuppliers([supplier.id])
    return this.mapper.toSupplier(supplier, counts.get(supplier.id) ?? 0)
  }

  @TypedRoute.Post(':id/unarchive', supplierSchema)
  @HttpCode(200)
  async unarchive(@TypedParam('id', z.string()) id: string) {
    const supplier = await this.catalog.unarchiveSupplier(id)
    const counts = await this.catalog.productCountForSuppliers([supplier.id])
    return this.mapper.toSupplier(supplier, counts.get(supplier.id) ?? 0)
  }
}

@TypedController('admin/categories', undefined, { tags: ['Admin Catalog'] })
@UseGuards(AuthGuard)
@AdminOnly()
export class AdminCategoriesController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly mapper: CatalogMapper,
  ) {}

  @TypedRoute.Get('', categoriesListSchema)
  async list(@Query('includeArchived') includeArchived?: string) {
    const categories = await this.catalog.listCategories({
      includeArchived: isTrue(includeArchived),
    })
    const counts = await this.catalog.productCountFor(categories.map((category) => category.id))
    return categories.map((category) =>
      this.mapper.toCategory(category, counts.get(category.id) ?? 0),
    )
  }

  @TypedRoute.Post('', categorySchema)
  async create(@TypedBody(createCategorySchema) body: CreateCategoryInput) {
    const category = await this.catalog.createCategory(body)
    return this.mapper.toCategory(category, 0)
  }

  @TypedRoute.Put(':id', categorySchema)
  async update(
    @TypedParam('id', z.string()) id: string,
    @TypedBody(updateCategorySchema) body: UpdateCategoryInput,
  ) {
    const category = await this.catalog.updateCategory(id, body)
    const counts = await this.catalog.productCountFor([category.id])
    return this.mapper.toCategory(category, counts.get(category.id) ?? 0)
  }

  @TypedRoute.Post(':id/archive', categorySchema)
  @HttpCode(200)
  async archive(@TypedParam('id', z.string()) id: string) {
    const category = await this.catalog.archiveCategory(id)
    return this.mapper.toCategory(category, 0)
  }

  @TypedRoute.Post(':id/unarchive', categorySchema)
  @HttpCode(200)
  async unarchive(@TypedParam('id', z.string()) id: string) {
    const category = await this.catalog.unarchiveCategory(id)
    const counts = await this.catalog.productCountFor([category.id])
    return this.mapper.toCategory(category, counts.get(category.id) ?? 0)
  }
}

@TypedController('admin/products', undefined, { tags: ['Admin Catalog'] })
@UseGuards(AuthGuard)
@AdminOnly()
export class AdminProductsController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly mapper: CatalogMapper,
  ) {}

  @TypedRoute.Get('', productsListSchema)
  async list(
    @PaginationParams(productPaginationSchema) pagination: ProductPagination,
    @SortingParams(productSortingSchema) sort?: ProductSorting,
    @FilteringParams(productFilteringSchema) filter?: ProductFiltering,
    @Query('includeArchived') includeArchived?: string,
  ) {
    const result = await this.catalog.listProducts(pagination, sort, filter, {
      includeArchived: isTrue(includeArchived),
    })
    return this.mapper.toProductsList(result)
  }

  @TypedRoute.Get(':id', productDetailSchema)
  async get(@TypedParam('id', z.string()) id: string) {
    const product = await this.catalog.getProductDetail(id)
    return this.mapper.toProductDetail(product)
  }

  @TypedRoute.Post('', productDetailSchema)
  async create(
    @Session() session: LoggedInBetterAuthSession,
    @TypedBody(createProductSchema) body: CreateProductInput,
  ) {
    const product = await this.catalog.createProduct(body, session.user.id)
    return this.mapper.toProductDetail(await this.catalog.getProductDetail(product.id))
  }

  @TypedRoute.Put(':id', productDetailSchema)
  async update(
    @TypedParam('id', z.string()) id: string,
    @TypedBody(updateProductSchema) body: UpdateProductInput,
  ) {
    await this.catalog.updateProduct(id, body)
    return this.mapper.toProductDetail(await this.catalog.getProductDetail(id))
  }

  @TypedRoute.Post(':id/price', productDetailSchema)
  @HttpCode(200)
  async setPrice(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('id', z.string()) id: string,
    @TypedBody(setProductPriceSchema) body: SetProductPriceInput,
  ) {
    await this.catalog.setProductPrice(id, body, session.user.id)
    return this.mapper.toProductDetail(await this.catalog.getProductDetail(id))
  }

  @TypedRoute.Post(':id/archive', productSchema)
  @HttpCode(200)
  async archive(@TypedParam('id', z.string()) id: string) {
    const product = await this.catalog.archiveProduct(id)
    return this.mapper.toProduct(await this.catalog.getProductDetail(product.id))
  }

  @TypedRoute.Post(':id/unarchive', productSchema)
  @HttpCode(200)
  async unarchive(@TypedParam('id', z.string()) id: string) {
    const product = await this.catalog.unarchiveProduct(id)
    return this.mapper.toProduct(await this.catalog.getProductDetail(product.id))
  }
}
