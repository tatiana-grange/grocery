import { Tabs, TabsContent, TabsList, TabsTrigger } from '@grocery/ui/components/primitives/tabs'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { CategoriesTab } from '@/features/catalog/components/categories-tab'
import { ProductsTab } from '@/features/catalog/components/products-tab'
import { SuppliersTab } from '@/features/catalog/components/suppliers-tab'

const TABS = ['products', 'suppliers', 'categories'] as const

export default function CatalogPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') ?? 'products') as (typeof TABS)[number]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">{t('catalog.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('catalog.subtitle')}</p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          const params = new URLSearchParams(searchParams)
          params.set('tab', value)
          setSearchParams(params)
        }}
      >
        <TabsList>
          {TABS.map((name) => (
            <TabsTrigger key={name} value={name}>
              {t(`catalog.tabs.${name}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="products" className="mt-6">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="suppliers" className="mt-6">
          <SuppliersTab />
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <CategoriesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
