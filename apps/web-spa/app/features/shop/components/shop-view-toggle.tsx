import { Button } from '@grocery/ui/components/primitives/button'
import { Grid3x3, LayoutGrid, List } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SHOP_VIEWS, type ShopView } from '@/features/shop/hooks/use-shop-view'

const ICONS = { large: LayoutGrid, compact: Grid3x3, list: List } as const

export function ShopViewToggle({
  view,
  onChange,
}: {
  view: ShopView
  onChange: (view: ShopView) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex gap-1" data-testid="shop-view-toggle">
      {SHOP_VIEWS.map((option) => {
        const Icon = ICONS[option]
        return (
          <Button
            key={option}
            type="button"
            size="icon-sm"
            variant={view === option ? 'default' : 'outline'}
            aria-pressed={view === option}
            aria-label={t(`shop.view.${option}`)}
            data-testid={`shop-view-${option}`}
            onClick={() => onChange(option)}
          >
            <Icon className="size-4" />
          </Button>
        )
      })}
    </div>
  )
}
