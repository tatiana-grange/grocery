import { SegmentedControl } from '@grocery/ui/components/primitives/segmented-control'
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
    <SegmentedControl
      data-testid="shop-view-toggle"
      className="gap-1"
      size="icon-sm"
      value={view}
      onChange={onChange}
      options={SHOP_VIEWS.map((option) => {
        const Icon = ICONS[option]
        const name = t(`shop.view.${option}`)
        return {
          value: option,
          // SegmentedControl takes no title; the wrapper fills the button, so hovering it
          // anywhere shows the name of the view.
          label: (
            <span title={name} className="flex size-full items-center justify-center">
              <Icon className="size-5" />
            </span>
          ),
          ariaLabel: name,
          testId: `shop-view-${option}`,
        }
      })}
    />
  )
}
