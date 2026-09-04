import { Injectable } from '@nestjs/common'
import { centsToEur, currentPrice, pricingUnitFor } from './catalog.util'
import type { Category as CategoryContract } from './contracts/category.contract'
import type { PriceWindow } from './contracts/product-price.contract'
import type {
  ProducerCategory as ProducerCategoryContract,
  ProducerCategoriesList,
} from './contracts/producer-category.contract'
import type {
  ShopCategory,
  ShopProduct,
  ShopProductDetail,
  ShopProductsList,
} from './contracts/shop-catalog.contract'
import type {
  Product as ProductContract,
  ProductDetail,
  ProductsList,
} from './contracts/product.contract'
import type { Referent as ReferentContract, ReferentsList } from './contracts/referent.contract'
import type { Supplier as SupplierContract, SuppliersList } from './contracts/supplier.contract'
import { Category } from './entities/category.entity'
import { ProducerCategory } from './entities/producer-category.entity'
import { ProductPrice } from './entities/product-price.entity'
import { Product } from './entities/product.entity'
import { Referent } from './entities/referent.entity'
import { Supplier } from './entities/supplier.entity'
import type { ProductsListResult } from './catalog.service'

@Injectable()
export class CatalogMapper {
  toSupplier(supplier: Supplier, productCount: number): SupplierContract {
    return {
      id: supplier.id,
      name: supplier.name,
      type: supplier.type,
      contactName: supplier.contactName ?? null,
      contactEmail: supplier.contactEmail ?? null,
      contactPhone: supplier.contactPhone ?? null,
      notes: supplier.notes ?? null,
      deliveryMode: supplier.deliveryMode ?? null,
      referent: supplier.referent
        ? {
            id: supplier.referent.id,
            firstName: supplier.referent.firstName ?? null,
            lastName: supplier.referent.lastName,
          }
        : null,
      producerCategories: supplier.producerCategories.isInitialized()
        ? supplier.producerCategories.getItems().map((category) => ({
            id: category.id,
            name: category.name,
          }))
        : [],
      archivedAt: supplier.archivedAt ?? null,
      productCount,
      version: supplier.version,
      createdAt: supplier.createdAt,
    }
  }

  toReferent(referent: Referent, supplierCount: number): ReferentContract {
    return {
      id: referent.id,
      firstName: referent.firstName ?? null,
      lastName: referent.lastName,
      contactEmail: referent.contactEmail ?? null,
      contactPhone: referent.contactPhone ?? null,
      userId: referent.user?.id ?? null,
      supplierCount,
      version: referent.version,
      createdAt: referent.createdAt,
    }
  }

  toReferentsList(referents: Referent[], supplierCounts: Map<string, number>): ReferentsList {
    return referents.map((referent) =>
      this.toReferent(referent, supplierCounts.get(referent.id) ?? 0),
    )
  }

  toProducerCategory(category: ProducerCategory, supplierCount: number): ProducerCategoryContract {
    return {
      id: category.id,
      name: category.name,
      archivedAt: category.archivedAt ?? null,
      supplierCount,
      version: category.version,
    }
  }

  toProducerCategoriesList(
    categories: ProducerCategory[],
    supplierCounts: Map<string, number>,
  ): ProducerCategoriesList {
    return categories.map((category) =>
      this.toProducerCategory(category, supplierCounts.get(category.id) ?? 0),
    )
  }

  toSuppliersList(
    suppliers: Supplier[],
    total: number,
    pagination: { pageSize: number; offset: number },
    productCounts: Map<string, number>,
  ): SuppliersList {
    return {
      data: suppliers.map((supplier) =>
        this.toSupplier(supplier, productCounts.get(supplier.id) ?? 0),
      ),
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    }
  }

  toCategory(category: Category, productCount: number): CategoryContract {
    return {
      id: category.id,
      name: category.name,
      parentId: category.parent?.id ?? null,
      archivedAt: category.archivedAt ?? null,
      productCount,
      version: category.version,
    }
  }

  private currentPriceEur(product: Product): number | null {
    const price = currentPrice(product)
    return price ? centsToEur(price.amountCents) : null
  }

  toProduct(product: Product): ProductContract {
    return {
      id: product.id,
      name: product.name,
      description: product.description ?? null,
      supplier: { id: product.supplier.id, name: product.supplier.name },
      category: { id: product.category.id, name: product.category.name },
      saleMode: product.saleMode,
      pricingUnit: pricingUnitFor(product.saleMode),
      orderingMode: product.orderingMode,
      photos: product.photos,
      labels: product.labels,
      barcode: product.barcode ?? null,
      currentPriceEur: this.currentPriceEur(product),
      archivedAt: product.archivedAt ?? null,
      version: product.version,
      createdAt: product.createdAt,
    }
  }

  private toPriceWindow(price: ProductPrice): PriceWindow {
    return {
      id: price.id,
      amountEur: centsToEur(price.amountCents),
      currency: price.currency,
      validFrom: price.validFrom,
      validTo: price.validTo ?? null,
      setByName: price.setByUser?.name ?? null,
    }
  }

  toProductDetail(product: Product): ProductDetail {
    const history = product.prices.isInitialized()
      ? [...product.prices.getItems()].sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime())
      : []

    return {
      ...this.toProduct(product),
      priceHistory: history.map((price) => this.toPriceWindow(price)),
      averageWeightGrams: product.averageWeightGrams ?? null,
      weightTolerancePercent: product.weightTolerancePercent ?? null,
    }
  }

  toProductsList({ products, total, pagination }: ProductsListResult): ProductsList {
    return {
      data: products.map((product) => this.toProduct(product)),
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    }
  }

  // ============================================================================================
  // Public shop
  // ============================================================================================

  toShopCategory(category: Category): ShopCategory {
    return { id: category.id, name: category.name }
  }

  toShopProduct(product: Product): ShopProduct {
    return {
      id: product.id,
      name: product.name,
      category: { id: product.category.id, name: product.category.name },
      saleMode: product.saleMode,
      pricingUnit: pricingUnitFor(product.saleMode),
      photos: product.photos,
      labels: product.labels,
      // Every product carries an open price from creation (see CatalogService.createProduct).
      currentPriceEur: this.currentPriceEur(product) ?? 0,
      orderingMode: product.orderingMode,
    }
  }

  toShopProductDetail(product: Product): ShopProductDetail {
    return {
      ...this.toShopProduct(product),
      description: product.description ?? null,
      barcode: product.barcode ?? null,
    }
  }

  toShopProductsList({ products, total, pagination }: ProductsListResult): ShopProductsList {
    return {
      data: products.map((product) => this.toShopProduct(product)),
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    }
  }
}
