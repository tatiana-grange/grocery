import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { cn } from '@grocery/ui/lib/utils'
import { Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import type { CartLineActions } from '@/features/cart/hooks/use-cart-line-actions'
import {
  formatQuantity,
  parseQuantity,
  pickerStep,
  type QuantityPickerProduct,
  quantityMin,
  quantityStep,
  selectionUnitLabel,
} from '@/features/cart/utils/cart-quantity'
import { authClient } from '@/lib/auth-client'

// On a dark background the neutral outline melts into the card and the keys read as disabled,
// so they take the primary tint there. Light mode keeps the plain outline, which already stands
// out against white.
const stepperButtonClass =
  'dark:border-primary/40 dark:bg-primary/15 dark:text-primary dark:hover:bg-primary/25'

// A number field still gets the browser's up/down spinner, which duplicates the +/- keys and
// steps by its own rules. Hidden in WebKit and, through the standard property, in Firefox.
const noSpinnerClass =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

interface AddToCartTestIds {
  root?: string
  signIn: string
  add: string
  decrease: string
  increase: string
  amount: string
}

/**
 * The one add-to-cart control, used by the shop cards, the product page and the cart rows.
 *
 * It has three states, and which one shows is settled by the cart itself, never by a flag:
 * a signed-out visitor gets a button that sends them to sign in; a product that isn't in the
 * cart gets a single add button; a product that is gets a minus / amount / plus stepper. A
 * by-weight product makes the amount an editable field with its unit beside it, a unit-sale
 * product just shows the piece count. On the cart page only the last state can ever happen.
 *
 * The writes come in through `actions`, so the caller decides what "add", "update" and
 * "remove" mean without this component knowing which page it is on.
 *
 * All arithmetic happens in the picker unit — what the shopper reads, grams for a product
 * served in grams — and converts to the cart's stored unit (kilograms or whole pieces) once,
 * on the way out. `line.quantity` is in that stored unit.
 *
 * The amount shown is optimistic: a step or an edit appears right away, then falls back to the
 * server value once the write settles, so a rejected change never sticks on screen.
 */
export function AddToCartControl({
  product,
  line,
  actions,
  size = 'default',
  className,
  testIds,
}: {
  product: QuantityPickerProduct
  line?: { quantity: number } | null
  actions: CartLineActions
  size?: 'sm' | 'default'
  className?: string
  testIds: AddToCartTestIds
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: sessionData } = authClient.useSession()

  const { pending } = actions
  const step = pickerStep(product)
  const isWeight = product.saleMode === 'weight'
  const serverAmount = line ? formatQuantity(product, line.quantity) : ''

  // Draft holds the optimistic or half-typed amount; null means "show the server value". It is
  // dropped when the server value changes (the change landed) and when a write settles without
  // changing it (the change was rejected) — the second case is why `pending` is watched here.
  const [draft, setDraft] = useState<string | null>(null)
  // What the write in flight asked for. The amount field stays editable while a write is in
  // flight, so a settling write may only drop the draft it put there itself; whatever the
  // shopper has typed since then is theirs, and must not be wiped out from under them.
  const sentAmount = useRef<string | null>(null)
  const dropSentDraft = useCallback(() => {
    setDraft((current) => (current === sentAmount.current ? null : current))
    sentAmount.current = null
  }, [])
  const wasPending = useRef(pending)
  useEffect(() => {
    if (wasPending.current && !pending) dropSentDraft()
    wasPending.current = pending
  }, [pending, dropSentDraft])
  useEffect(() => {
    dropSentDraft()
  }, [serverAmount, dropSentDraft])

  const shown = draft ?? serverAmount

  // Applies an amount in the picker's unit. Stepping or typing down to nothing is a request to
  // drop the line, which is what the shopper means by taking the last piece back off.
  const apply = (next: number) => {
    if (!Number.isFinite(next) || next === Number(serverAmount)) {
      sentAmount.current = null
      setDraft(null)
      return
    }
    if (next <= 0) {
      sentAmount.current = null
      setDraft(null)
      actions.remove()
      return
    }
    sentAmount.current = String(next)
    setDraft(String(next))
    actions.update(parseQuantity(product, String(next)))
  }

  const stepBy = (direction: 1 | -1) => {
    const next = Number((Number(shown) + direction * step).toFixed(3))
    if (next !== Number(shown)) apply(next)
  }

  const addButton = (label: string, testId: string, onClick: () => void) => (
    <Button
      size={size}
      className={cn('w-full', className)}
      data-testid={testId}
      disabled={pending}
      onClick={onClick}
    >
      <Plus className={size === 'sm' ? 'size-3.5' : 'size-4'} />
      {label}
    </Button>
  )

  if (!sessionData) {
    return addButton(t('shop.quickAdd.add'), testIds.signIn, () =>
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`),
    )
  }

  // Nothing in the cart yet: one button that adds a single step. The amount is adjusted
  // afterwards, in the stepper this turns into, rather than guessed at beforehand.
  if (!line) {
    return addButton(t('shop.quickAdd.add'), testIds.add, () => actions.add(quantityStep(product)))
  }

  const buttonSize = size === 'sm' ? 'icon-sm' : 'icon'

  return (
    <div
      className={cn('flex w-full items-center justify-between gap-2', className)}
      data-testid={testIds.root}
    >
      <Button
        variant="outline"
        size={buttonSize}
        className={stepperButtonClass}
        aria-label={t('shop.quickAdd.decrease')}
        data-testid={testIds.decrease}
        disabled={pending}
        onClick={() => stepBy(-1)}
      >
        <Minus className="size-3" />
      </Button>
      <div className="flex items-center gap-1">
        {isWeight ? (
          <>
            <Input
              type="number"
              step={step}
              min={quantityMin(product)}
              className={cn('w-16 text-center', noSpinnerClass, size === 'sm' && 'h-7')}
              aria-label={t('shop.quickAdd.amount')}
              data-testid={testIds.amount}
              value={shown}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => apply(Number(shown))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
            <span className="text-sm text-muted-foreground">
              {t(`catalog.pricingUnit.${selectionUnitLabel(product)}`)}
            </span>
          </>
        ) : (
          <span className="text-sm font-semibold tabular-nums" data-testid={testIds.amount}>
            {shown}
          </span>
        )}
      </div>
      <Button
        variant="outline"
        size={buttonSize}
        className={stepperButtonClass}
        aria-label={t('shop.quickAdd.increase')}
        data-testid={testIds.increase}
        disabled={pending}
        onClick={() => stepBy(1)}
      >
        <Plus className="size-3" />
      </Button>
    </div>
  )
}
