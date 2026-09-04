import { Button } from '@grocery/ui/components/primitives/button'
import { useTranslation } from 'react-i18next'
import type { ShopCategory } from '@grocery/openapi-generator/client/types.gen'

export function CategoryFilter({
  categories,
  selectedCategoryId,
  onSelect,
}: {
  categories: ShopCategory[]
  selectedCategoryId?: string
  onSelect: (categoryId?: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap gap-2" data-testid="shop-category-filter">
      <Button
        type="button"
        size="sm"
        variant={selectedCategoryId ? 'outline' : 'default'}
        data-testid="shop-category-filter-all"
        onClick={() => onSelect(undefined)}
      >
        {t('shop.categories.all')}
      </Button>
      {categories.map((category) => (
        <Button
          key={category.id}
          type="button"
          size="sm"
          variant={selectedCategoryId === category.id ? 'default' : 'outline'}
          data-testid={`shop-category-filter-${category.id}`}
          onClick={() => onSelect(category.id)}
        >
          {category.name}
        </Button>
      ))}
    </div>
  )
}
