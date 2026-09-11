import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { InventoryModule } from '../inventory/inventory.module'
import {
  AdminCategoriesController,
  AdminProducerCategoriesController,
  AdminProductsController,
  AdminReferentsController,
  AdminSuppliersController,
} from './catalog.controller'
import { CatalogMapper } from './catalog.mapper'
import { CatalogService } from './catalog.service'
import { Category } from './entities/category.entity'
import { ProducerCategory } from './entities/producer-category.entity'
import { ProductPrice } from './entities/product-price.entity'
import { Product } from './entities/product.entity'
import { Referent } from './entities/referent.entity'
import { Supplier } from './entities/supplier.entity'
import { ShopCatalogController } from './shop-catalog.controller'

@Module({
  imports: [
    MikroOrmModule.forFeature([
      Supplier,
      Category,
      Product,
      ProductPrice,
      Referent,
      ProducerCategory,
    ]),
    // The public shop shows each product's stock level, which lives in the inventory ledger.
    InventoryModule,
  ],
  controllers: [
    AdminSuppliersController,
    AdminReferentsController,
    AdminCategoriesController,
    AdminProducerCategoriesController,
    AdminProductsController,
    ShopCatalogController,
  ],
  providers: [CatalogService, CatalogMapper],
  exports: [CatalogService],
})
export class CatalogModule {}
