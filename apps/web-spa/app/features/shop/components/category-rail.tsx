import type { ShopCategory } from '@grocery/openapi-generator/client/types.gen'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@grocery/ui/components/primitives/accordion'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@grocery/ui/components/primitives/sheet'
import { cn } from '@grocery/ui/lib/utils'
import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface CategoryRailProps {
  categories: ShopCategory[]
  selectedCategoryId?: string
  onSelect: (categoryId?: string) => void
}

/** One selectable line: category name on the left, its product count on the right. */
function Row({
  label,
  count,
  active,
  testId,
  indent,
  onSelect,
}: {
  label: string
  count: number
  active: boolean
  testId: string
  indent?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-current={active ? 'true' : undefined}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        indent && 'pl-4',
        active
          ? 'bg-accent font-medium text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
    >
      <span className="min-w-0 wrap-break-word">{label}</span>
      <span className="ml-auto shrink-0 text-xs text-muted-foreground/70 tabular-nums">
        {count}
      </span>
    </button>
  )
}

/**
 * Vertical category navigation for the shop. Every top-level category is an accordion —
 * expanding one reveals an "All {family}" row (products of the family and all its children)
 * plus each child. A category with no children still expands, on its "All {family}" row alone.
 */
export function CategoryRail({ categories, selectedCategoryId, onSelect }: CategoryRailProps) {
  const { t } = useTranslation()

  const { topLevel, childrenByParent, grandTotal } = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category]))
    const children = new Map<string, ShopCategory[]>()
    for (const category of categories) {
      if (category.parentId && byId.has(category.parentId)) {
        const bucket = children.get(category.parentId) ?? []
        bucket.push(category)
        children.set(category.parentId, bucket)
      }
    }
    return {
      topLevel: categories.filter((c) => c.parentId === null || !byId.has(c.parentId)),
      childrenByParent: children,
      grandTotal: categories.reduce((sum, c) => sum + c.productCount, 0),
    }
  }, [categories])

  const familyTotal = (family: ShopCategory) =>
    family.productCount +
    (childrenByParent.get(family.id) ?? []).reduce((sum, c) => sum + c.productCount, 0)

  // The family (or standalone category) that holds the current selection — keep it open.
  const activeFamilyId = selectedCategoryId
    ? (categories.find((c) => c.id === selectedCategoryId)?.parentId ?? selectedCategoryId)
    : undefined
  const [open, setOpen] = useState<string[]>(activeFamilyId ? [activeFamilyId] : [])
  useEffect(() => {
    if (activeFamilyId) {
      setOpen((prev) => (prev.includes(activeFamilyId) ? prev : [...prev, activeFamilyId]))
    }
  }, [activeFamilyId])

  return (
    <nav className="space-y-0.5" data-testid="shop-category-filter">
      <Row
        label={t('shop.categories.all')}
        count={grandTotal}
        active={!selectedCategoryId}
        testId="shop-category-filter-all"
        onSelect={() => onSelect(undefined)}
      />

      <Accordion multiple value={open} onValueChange={setOpen}>
        {topLevel.map((family) => {
          const kids = childrenByParent.get(family.id) ?? []
          return (
            <AccordionItem key={family.id} value={family.id} className="border-b-0">
              <AccordionTrigger className="gap-2 rounded-md border-0 px-2 py-1.5 font-normal text-muted-foreground hover:bg-accent/50 hover:text-foreground hover:no-underline">
                <span className="min-w-0 flex-1 wrap-break-word">{family.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground/70 tabular-nums">
                  {familyTotal(family)}
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-0.5 pb-1">
                <Row
                  label={t('shop.categories.everythingIn', { name: family.name })}
                  count={familyTotal(family)}
                  active={selectedCategoryId === family.id}
                  testId={`shop-category-filter-${family.id}`}
                  indent
                  onSelect={() => onSelect(family.id)}
                />
                {kids.map((kid) => (
                  <Row
                    key={kid.id}
                    label={kid.name}
                    count={kid.productCount}
                    active={selectedCategoryId === kid.id}
                    testId={`shop-category-filter-${kid.id}`}
                    indent
                    onSelect={() => onSelect(kid.id)}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </nav>
  )
}

/** Mobile entry point: a button that opens the rail in a left-hand sheet. */
export function CategoryRailSheet(props: CategoryRailProps) {
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)
  const currentName = props.selectedCategoryId
    ? props.categories.find((c) => c.id === props.selectedCategoryId)?.name
    : undefined

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger
        data-testid="shop-category-sheet-trigger"
        className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
      >
        <SlidersHorizontal className="size-4" />
        {currentName ?? t('shop.categories.heading')}
      </SheetTrigger>
      <SheetContent side="left" className="w-80 gap-0 p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t('shop.categories.heading')}</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto p-3">
          <CategoryRail
            {...props}
            onSelect={(id) => {
              props.onSelect(id)
              setSheetOpen(false)
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
