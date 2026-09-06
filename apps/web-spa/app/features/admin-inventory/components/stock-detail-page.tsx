import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@grocery/ui/components/primitives/table'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { stockDetailQueryOptions } from '@/features/admin-inventory/utils/inventory-queries'

export default function StockDetailPage() {
  const { t } = useTranslation()
  const { productId = '' } = useParams()
  const { data, isLoading } = useQuery(stockDetailQueryOptions(productId))

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" data-testid="stock-detail-loading" />
  }

  return (
    <div className="space-y-6" data-testid="page-stock-detail">
      <Button
        variant="ghost"
        size="sm"
        render={<Link to="/admin/inventory" />}
        data-testid="stock-detail-back"
      >
        <ArrowLeft className="mr-2 size-4" />
        {t('inventory.backToList')}
      </Button>

      <div>
        <h1 className="text-2xl font-black tracking-tight">{data.product.name}</h1>
        <div className="mt-2 flex gap-6 text-sm">
          <span data-testid="stock-detail-on-hand">
            {t('inventory.columns.onHand')}:{' '}
            <span className="font-semibold">{data.quantityOnHand}</span>
          </span>
          <span data-testid="stock-detail-cost">
            {t('inventory.columns.costPrice')}:{' '}
            <span className="font-semibold">
              {data.costPriceEur == null
                ? t('inventory.noCostPrice')
                : t('inventory.costValue', { value: data.costPriceEur.toFixed(2) })}
            </span>
          </span>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{t('inventory.movementsHeading')}</h2>
        {data.movements.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="stock-detail-no-movements">
            {t('inventory.noMovements')}
          </p>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('inventory.columns.date')}</TableHead>
                  <TableHead>{t('inventory.columns.reason')}</TableHead>
                  <TableHead className="text-right">{t('inventory.columns.quantity')}</TableHead>
                  <TableHead className="text-right">{t('inventory.columns.unitCost')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.movements.map((movement) => (
                  <TableRow key={movement.id} data-testid={`stock-movement-${movement.id}`}>
                    <TableCell>{new Date(movement.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{t(`inventory.reason.${movement.reason}`)}</TableCell>
                    <TableCell className="text-right tabular-nums">{movement.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t('inventory.costValue', { value: movement.unitCostEur.toFixed(2) })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
