import {
  FilteringParams,
  PaginationParams,
  SortingParams,
  TypedController,
  TypedParam,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { Public } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import { CatalogMapper } from './catalog.mapper'
import { CatalogService } from './catalog.service'
import {
  type ShopProductFiltering,
  shopProductFilteringSchema,
  type ShopProductPagination,
  shopProductPaginationSchema,
  shopProductDetailSchema,
  shopCategoriesListSchema,
  type ShopProductSorting,
  shopProductSortingSchema,
  shopProductsListSchema,
} from './contracts/shop-catalog.contract'

/**
 * Public, read-only surface over the catalogue: non-archived products only, a narrower
 * contract than the admin controllers (no price history, no supplier detail, no version).
 * Kept in its own controller/file so the `@Public()` surface stays easy to audit for field
 * leaks — see plan.md Complexity Tracking.
 */
@TypedController('shop', undefined, { tags: ['Shop'] })
@UseGuards(AuthGuard)
@Public()
export class ShopCatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly mapper: CatalogMapper,
  ) {}

  @TypedRoute.Get('categories', shopCategoriesListSchema)
  async listCategories() {
    const categories = await this.catalog.listShopCategories()
    return categories.map((category) => this.mapper.toShopCategory(category))
  }

  @TypedRoute.Get('products', shopProductsListSchema)
  async listProducts(
    @PaginationParams(shopProductPaginationSchema) pagination: ShopProductPagination,
    @SortingParams(shopProductSortingSchema) sort?: ShopProductSorting,
    @FilteringParams(shopProductFilteringSchema) filter?: ShopProductFiltering,
  ) {
    const result = await this.catalog.listShopProducts(pagination, sort, filter)
    return this.mapper.toShopProductsList(result)
  }

  @TypedRoute.Get('products/:id', shopProductDetailSchema)
  async getProduct(@TypedParam('id', z.string()) id: string) {
    const product = await this.catalog.getShopProductDetail(id)
    return this.mapper.toShopProductDetail(product)
  }
}
