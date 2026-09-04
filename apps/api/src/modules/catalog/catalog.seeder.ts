import { Dictionary, EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { createCategoryData, createProductData, createSupplierData } from './catalog.factory'

/**
 * Seeds a small catalogue for manual testing: two suppliers, one category, and two products
 * — one sold per unit, one sold by weight — each with an initial price.
 */
export class CatalogSeeder extends Seeder {
  async run(em: EntityManager, context: Dictionary): Promise<void> {
    const producer = await createSupplierData(em, { name: 'Ferme des Prés', type: 'producer' })
    await createSupplierData(em, { name: 'Grossiste Bio Sud', type: 'wholesaler' })
    const category = await createCategoryData(em, { name: 'Fruits & légumes' })

    await createProductData(em, {
      name: 'Pommes Golden',
      saleMode: 'weight',
      priceEur: 2.4,
      supplier: producer,
      category,
      setByUser: context.adminUser,
    })
    await createProductData(em, {
      name: 'Pain de campagne',
      saleMode: 'unit',
      priceEur: 3.2,
      supplier: producer,
      category,
      setByUser: context.adminUser,
    })
  }
}
