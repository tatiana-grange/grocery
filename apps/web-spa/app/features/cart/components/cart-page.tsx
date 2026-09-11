import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@grocery/ui/components/primitives/alert-dialog'
import { EmptyState, PageTitle } from '@grocery/ui/components/app'
import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { toast } from '@grocery/ui/components/primitives/sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@grocery/ui/components/primitives/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { ShoppingCart, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { CartLine } from '@grocery/openapi-generator/client/types.gen'
import { handleMutationError } from '@/features/common/lib/api-error'
import { AddToCartControl } from '@/features/cart/components/add-to-cart-control'
import { CheckoutConfirmation } from '@/features/cart/components/checkout-confirmation'
import { useCartLineActions } from '@/features/cart/hooks/use-cart-line-actions'
import { type CartLinePickup, splitCartByPickup } from '@/features/cart/utils/cart-pickup'
import { cartQueryOptions, checkout, type CheckoutResult } from '@/features/cart/utils/cart-queries'
import { formatQuantity, selectionUnitLabel } from '@/features/cart/utils/cart-quantity'

/** A quantity in the line's own unit: a plain count, or a weight that names its unit. */
function quantityLabel(product: CartLine['product'], quantity: number, t: TFunction) {
  const unit =
    product.saleMode === 'weight'
      ? ` ${t(`catalog.pricingUnit.${selectionUnitLabel(product)}`)}`
      : ''
  return `${formatQuantity(product, quantity)}${unit}`
}

/**
 * One cart line, with what the shopper can walk away with spelled out under the product name.
 *
 * The line stays whole — one row, one stepper, one total — because it is one order for one
 * product. Only the collection dates differ, so when part of it is waiting on a delivery the
 * row breaks the quantity down into what comes at the next distribution and what comes after.
 */
function CartLineRow({ pickup }: { pickup: CartLinePickup }) {
  const { t } = useTranslation()
  const { line, now, later } = pickup
  const { product } = line

  const actions = useCartLineActions({
    productId: product.id,
    orderingMode: line.orderingMode,
    lineId: line.id,
  })

  const amount = (quantity: number) => quantityLabel(product, quantity, t)

  return (
    <TableRow data-testid={`cart-line-${line.id}`}>
      {/* The pickup breakdown is a sentence, not a label: it has to wrap inside the column
          rather than push the table wider than the page. */}
      <TableCell className="font-medium whitespace-normal wrap-break-word">
        {product.name}
        {/* The ordering mode is a catalogue detail the shopper has already acted on; what it
            means for them here is the pickup breakdown below. Only a problem with the line
            still earns a badge. */}
        {!line.isValid && line.invalidReasonCode && (
          <div className="mt-1">
            <Badge variant="destructive" data-testid={`cart-line-invalid-${line.id}`}>
              {t(`cart.invalidReason.${line.invalidReasonCode}`)}
            </Badge>
          </div>
        )}
        {/* Nothing to explain while the whole line arrives at the next distribution — which is
            what a shopper already expects — so the breakdown only shows up once some of it has
            to wait for a delivery. */}
        {later > 0 && (
          <ul
            className="mt-1.5 space-y-0.5 text-xs text-muted-foreground"
            data-testid={`cart-line-pickup-${line.id}`}
          >
            {now > 0 && (
              <li className="flex gap-1.5" data-testid={`cart-line-pickup-now-${line.id}`}>
                <span aria-hidden="true">•</span>
                <span>{t('cart.pickup.now', { amount: amount(now) })}</span>
              </li>
            )}
            <li className="flex gap-1.5" data-testid={`cart-line-pickup-later-${line.id}`}>
              <span aria-hidden="true">•</span>
              {/* `count` picks the agreement, `amount` carries the formatting — a weight reads
                  as "0,5 kg", which French still treats as singular. */}
              <span>{t('cart.pickup.later', { amount: amount(later), count: later })}</span>
            </li>
          </ul>
        )}
      </TableCell>
      <TableCell>
        {/* The line is there by definition, so this only ever renders as the stepper. Taking the
            amount down to nothing drops the line, exactly as it does in the shop. */}
        <AddToCartControl
          product={product}
          line={line}
          actions={actions}
          className="w-auto"
          testIds={{
            signIn: `cart-line-signin-${line.id}`,
            add: `cart-line-add-${line.id}`,
            decrease: `cart-line-decrease-${line.id}`,
            increase: `cart-line-increase-${line.id}`,
            amount: `cart-line-quantity-${line.id}`,
          }}
        />
      </TableCell>
      <TableCell>{line.unitPriceEur.toFixed(2)} €</TableCell>
      <TableCell className="font-semibold">{line.lineTotalEur.toFixed(2)} €</TableCell>
      <TableCell>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="ghost" size="icon" data-testid={`cart-line-remove-${line.id}`} />
            }
          >
            <Trash2 className="size-4" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('cart.removeConfirm.title')}</AlertDialogTitle>
              <AlertDialogDescription>{t('cart.removeConfirm.description')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                data-testid={`cart-line-remove-confirm-${line.id}`}
                onClick={() => actions.remove()}
              >
                {t('cart.removeConfirm.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}

/**
 * What the shopper will not find waiting for them at the next distribution, gathered in one
 * place above the checkout button.
 *
 * The same amounts are already spelled out line by line, but a shopper decides on the whole
 * order at the bottom of the page, and that is where the surprise would otherwise be waiting.
 */
function PendingPickupNotice({ pickups }: { pickups: CartLinePickup[] }) {
  const { t } = useTranslation()
  const pending = pickups.filter((pickup) => pickup.later > 0)
  if (pending.length === 0) return null

  return (
    <div className="rounded-lg bg-muted p-4" data-testid="cart-pending-notice">
      <h2 className="text-sm font-semibold">{t('cart.pickup.summaryTitle')}</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {pending.map(({ line, later }) => (
          <li key={line.id} className="flex flex-wrap justify-between gap-x-4">
            <span>{line.product.name}</span>
            <span className="font-medium tabular-nums">
              {quantityLabel(line.product, later, t)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">{t('cart.pickup.summaryNote')}</p>
    </div>
  )
}

export default function CartPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: cart, isLoading, isFetching, error, refetch } = useQuery(cartQueryOptions())
  const [confirmation, setConfirmation] = useState<CheckoutResult | null>(null)

  const checkoutMutation = useMutation({
    mutationFn: checkout,
    onSuccess: (result) => {
      setConfirmation(result)
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
    onError: (error) =>
      handleMutationError(error, toast.error, {
        conflict: t('cart.checkout.emptyError'),
        fallback: t('cart.toasts.error'),
      }),
  })

  if (confirmation) {
    return (
      <div className="space-y-6" data-testid="page-cart">
        <PageTitle>{t('cart.checkout.title')}</PageTitle>
        <CheckoutConfirmation result={confirmation} />
        <Link
          to="/shop"
          className="text-sm font-medium underline"
          data-testid="checkout-back-to-shop"
        >
          {t('cart.browseShop')}
        </Link>
      </div>
    )
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />

  if (error || !cart) {
    return (
      <div className="space-y-4 text-center" data-testid="cart-load-error">
        <PageTitle>{t('cart.title')}</PageTitle>
        <p className="text-sm text-muted-foreground">{t('cart.loadError')}</p>
        <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  const pickups = splitCartByPickup(cart.lines)

  return (
    <div className="space-y-6" data-testid="page-cart">
      <PageTitle>{t('cart.title')}</PageTitle>

      {cart.lines.length === 0 ? (
        <div data-testid="cart-empty">
          <EmptyState
            icon={<ShoppingCart className="size-6 text-muted-foreground" />}
            title={t('cart.empty')}
          />
          <div className="text-center">
            <Link
              to="/shop"
              className="text-sm font-medium underline"
              data-testid="cart-browse-shop"
            >
              {t('cart.browseShop')}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border">
            {/* Fixed widths: the product name and its pickup breakdown would otherwise size the
                column from their longest line and scroll the table sideways. Everything else is
                a short number, so the product column takes whatever room is left. */}
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('cart.product')}</TableHead>
                  <TableHead className="w-44">{t('cart.quantity')}</TableHead>
                  <TableHead className="w-28">{t('cart.unitPrice')}</TableHead>
                  <TableHead className="w-32">{t('cart.lineTotal')}</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pickups.map((pickup) => (
                  <CartLineRow key={pickup.line.id} pickup={pickup} />
                ))}
              </TableBody>
            </Table>
          </div>

          <PendingPickupNotice pickups={pickups} />

          <div className="flex items-center justify-between">
            <span className="text-lg font-bold" data-testid="cart-total">
              {t('cart.total')}: {cart.totalEur.toFixed(2)} €
            </span>
            <Button
              data-testid="cart-checkout"
              disabled={checkoutMutation.isPending}
              onClick={() => checkoutMutation.mutate()}
            >
              {t('cart.checkout.action')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
