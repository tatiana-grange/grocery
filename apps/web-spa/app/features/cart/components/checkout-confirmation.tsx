import type { CheckoutResult } from '@/features/cart/utils/cart-queries'
import { Badge } from '@grocery/ui/components/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@grocery/ui/components/primitives/card'
import { useTranslation } from 'react-i18next'

/** Per-order summary shown after checkout: its lines, total, and what happens next. */
export function CheckoutConfirmation({ result }: { result: CheckoutResult }) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4" data-testid="checkout-confirmation">
      {result.droppedLines.length > 0 && (
        <div
          className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm"
          data-testid="checkout-dropped-lines"
        >
          <p className="font-semibold">{t('cart.checkout.droppedTitle')}</p>
          <ul className="mt-1 list-disc pl-5">
            {result.droppedLines.map((line) => (
              <li key={line.productName}>
                {line.productName} — {t(`cart.invalidReason.${line.reasonCode}`)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.orders.map((order) => (
        <Card key={order.id} data-testid={`checkout-order-${order.id}`}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t(`catalog.orderingMode.${order.orderingMode}`)}</span>
              <Badge variant="outline">{order.totalEur.toFixed(2)} €</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm">
              {order.lines.map((line) => (
                <li key={line.id} className="flex justify-between">
                  <span>
                    {line.productName} × {line.quantity}
                  </span>
                  <span>{line.lineTotalEur.toFixed(2)} €</span>
                </li>
              ))}
            </ul>
            <p
              className="text-sm text-muted-foreground"
              data-testid={`checkout-next-steps-${order.id}`}
            >
              {t(`cart.checkout.nextSteps.${order.orderingMode}`)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
