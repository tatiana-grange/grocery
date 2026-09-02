import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import {
  AdminCategoriesController,
  AdminProductsController,
  AdminSuppliersController,
} from './catalog.controller'
import { CatalogMapper } from './catalog.mapper'
import { CatalogService } from './catalog.service'
import { Category } from './entities/category.entity'
import { ProductPrice } from './entities/product-price.entity'
import { Product } from './entities/product.entity'
import { Supplier } from './entities/supplier.entity'

@Module({
  imports: [MikroOrmModule.forFeature([Supplier, Category, Product, ProductPrice])],
  controllers: [AdminSuppliersController, AdminCategoriesController, AdminProductsController],
  providers: [CatalogService, CatalogMapper],
  exports: [CatalogService],
})
export class CatalogModule {}
