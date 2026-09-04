import { Dictionary, EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import {
  createCategoryData,
  createProducerCategoryData,
  createProductData,
  createReferentData,
  createSupplierData,
} from './catalog.factory'

/**
 * Seeds a small catalogue for manual testing: two suppliers, two categories, and a spread of
 * products covering every ordering mode — plus a category whose only product is archived, so
 * the public shop's "hide empty categories" rule has something to exercise.
 */
export class CatalogSeeder extends Seeder {
  async run(em: EntityManager, context: Dictionary): Promise<void> {
    const referent = await createReferentData(em, { firstName: 'Alain', lastName: 'Grolleau' })
    const producerCategory = await createProducerCategoryData(em, { name: 'Fruits & légumes' })
    const producer = await createSupplierData(em, {
      name: 'Ferme des Prés',
      type: 'producer',
      deliveryMode: 'livraison',
      referent,
      producerCategories: [producerCategory],
    })
    await createSupplierData(em, { name: 'Grossiste Bio Sud', type: 'wholesaler' })
    const category = await createCategoryData(em, { name: 'Fruits & légumes' })
    const emptyCategory = await createCategoryData(em, { name: 'Épicerie (archivée)' })

    const setByUser = context.adminUser

    await createProductData(em, {
      name: 'Pommes Golden',
      saleMode: 'weight',
      orderingMode: 'in_store',
      priceEur: 2.4,
      supplier: producer,
      category,
      setByUser,
    })
    await createProductData(em, {
      name: 'Pain de campagne',
      saleMode: 'unit',
      orderingMode: 'in_store',
      priceEur: 3.2,
      supplier: producer,
      category,
      setByUser,
    })
    await createProductData(em, {
      name: 'Panier de légumes du producteur',
      saleMode: 'unit',
      orderingMode: 'pre_order',
      priceEur: 18,
      supplier: producer,
      category,
      setByUser,
    })
    await createProductData(em, {
      name: 'Carottes en vrac',
      saleMode: 'weight',
      orderingMode: 'both',
      priceEur: 1.9,
      supplier: producer,
      category,
      setByUser,
    })
    await createProductData(em, {
      name: 'Farine T65 (rupture)',
      saleMode: 'unit',
      orderingMode: 'in_store',
      priceEur: 1.5,
      supplier: producer,
      category: emptyCategory,
      setByUser,
      archivedAt: new Date(),
    })
  }
}
