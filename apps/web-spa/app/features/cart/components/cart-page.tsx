import type { CartLine } from '@grocery/openapi-generator/client/types.gen'
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
import { EmptyState } from '@grocery/ui/components/app'
import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
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
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { handleMutationError } from '@/features/common/lib/api-error'
import { CheckoutConfirmation } from '@/features/cart/components/checkout-confirmation'
import {
  cartQueryOptions,
  checkout,
  type CheckoutResult,
  removeCartLine,
  updateCartLine,
} from '@/features/cart/utils/cart-queries'

function CartLineRow({ line }: { line: CartLine }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [quantity, setQuantity] = useState(String(line.quantity))
  const step = line.product.saleMode === 'weight' ? 0.001 : 1

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['cart'] })

  const updateMutation = useMutation({
    mutationFn: (nextQuantity: number) => updateCartLine(line.id, { quantity: nextQuantity }),
    onSuccess: invalidate,
    onError: (error) =>
      handleMutationError(error, toast.error, {
        conflict: t('common.conflict'),
        fallback: t('cart.toasts.error'),
      }),
  })

  const removeMutation = useMutation({
    mutationFn: () => removeCartLine(line.id),
    onSuccess: () => {
      toast.success(t('cart.toasts.removed'))
      invalidate()
    },
    onError: () => toast.error(t('cart.toasts.error')),
  })

  const applyQuantity = (next: number) => {
    if (!(next > 0)) return
    setQuantity(String(next))
    updateMutation.mutate(next)
  }

  return (
    <TableRow data-testid={`cart-line-${line.id}`}>
      <TableCell className="font-medium">
        {line.product.name}
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge variant="outline">{t(`catalog.orderingMode.${line.orderingMode}`)}</Badge>
          {!line.isValid && (
            <Badge variant="destructive" data-testid={`cart-line-invalid-${line.id}`}>
              {line.invalidReason}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            data-testid={`cart-line-decrease-${line.id}`}
            onClick={() => applyQuantity(Number((Number(quantity) - step).toFixed(3)))}
          >
            <Minus className="size-3" />
          </Button>
          <Input
            type="number"
            step={step}
            className="w-20 text-center"
            data-testid={`cart-line-quantity-${line.id}`}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            onBlur={() => applyQuantity(Number(quantity))}
          />
          <Button
            variant="outline"
            size="icon"
            data-testid={`cart-line-increase-${line.id}`}
            onClick={() => applyQuantity(Number((Number(quantity) + step).toFixed(3)))}
          >
            <Plus className="size-3" />
          </Button>
        </div>
      </TableCell>
      <TableCell>{line.unitPriceEur.toFixed(2)} €</TableCell>
      <TableCell className="font-semibold">{line.lineTotalEur.toFixed(2)} €</TableCell>
      <TableCell>
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="ghost" size="icon" data-testid={`cart-line-remove-${line.id}`} />}
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
                onClick={() => removeMutation.mutate()}
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

export default function CartPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: cart, isLoading } = useQuery(cartQueryOptions())
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
        <h1 className="text-2xl font-black tracking-tight">{t('cart.checkout.title')}</h1>
        <CheckoutConfirmation result={confirmation} />
        <Link to="/shop" className="text-sm font-medium underline" data-testid="checkout-back-to-shop">
          {t('cart.browseShop')}
        </Link>
      </div>
    )
  }

  if (isLoading || !cart) return <Skeleton className="h-64 w-full" />

  return (
    <div className="space-y-6" data-testid="page-cart">
      <h1 className="text-2xl font-black tracking-tight">{t('cart.title')}</h1>

      {cart.lines.length === 0 ? (
        <div data-testid="cart-empty">
          <EmptyState icon={<ShoppingCart className="size-6 text-muted-foreground" />} title={t('cart.empty')} />
          <div className="text-center">
            <Link to="/shop" className="text-sm font-medium underline" data-testid="cart-browse-shop">
              {t('cart.browseShop')}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('cart.product')}</TableHead>
                  <TableHead>{t('cart.quantity')}</TableHead>
                  <TableHead>{t('cart.unitPrice')}</TableHead>
                  <TableHead>{t('cart.lineTotal')}</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.lines.map((line) => (
                  <CartLineRow key={line.id} line={line} />
                ))}
              </TableBody>
            </Table>
          </div>

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
