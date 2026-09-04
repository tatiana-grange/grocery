import { Injectable } from '@nestjs/common'
import { centsToEur, pricingUnitFor } from './catalog.util'
import type { Category as CategoryContract } from './contracts/category.contract'
import type { PriceWindow } from './contracts/product-price.contract'
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
import type { Supplier as SupplierContract, SuppliersList } from './contracts/supplier.contract'
import { Category } from './entities/category.entity'
import { ProductPrice } from './entities/product-price.entity'
import { Product } from './entities/product.entity'
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
      archivedAt: supplier.archivedAt ?? null,
      productCount,
      version: supplier.version,
      createdAt: supplier.createdAt,
    }
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
    if (!product.prices.isInitialized()) return null
    const current = product.prices.getItems().find((price) => !price.validTo)
    return current ? centsToEur(current.amountCents) : null
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
      ? [...product.prices.getItems()].sort(
          (a, b) => a.validFrom.getTime() - b.validFrom.getTime(),
        )
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
