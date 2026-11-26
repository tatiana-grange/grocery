import { SectionTitle } from '@grocery/ui/components/app'
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
import { BackOfficeFigureCard } from '@/features/common/components/back-office-figure-card'
import { BackOfficePageHead } from '@/features/common/components/back-office-page-head'
import { BackOfficeTableFrame } from '@/features/common/components/back-office-table-frame'
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
      <div>
        <Button
          variant="outline"
          size="sm"
          render={<Link to="/admin/inventory" />}
          data-testid="stock-detail-back"
        >
          <ArrowLeft />
          {t('inventory.backToList')}
        </Button>
      </div>

      <BackOfficePageHead
        title={data.product.name}
        figures={
          <>
            <BackOfficeFigureCard
              testId="stock-detail-on-hand"
              label={t('inventory.columns.onHand')}
              value={data.quantityOnHand}
            />
            <BackOfficeFigureCard
              testId="stock-detail-cost"
              label={t('inventory.columns.costPrice')}
              value={
                data.costPriceEur == null
                  ? t('inventory.noCostPrice')
                  : t('inventory.costValue', { value: data.costPriceEur.toFixed(2) })
              }
            />
          </>
        }
      />

      <section className="space-y-3">
        <SectionTitle>{t('inventory.movementsHeading')}</SectionTitle>
        {data.movements.length === 0 ? (
          <p className="text-base text-muted-foreground" data-testid="stock-detail-no-movements">
            {t('inventory.noMovements')}
          </p>
        ) : (
          <BackOfficeTableFrame>
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
          </BackOfficeTableFrame>
        )}
      </section>
    </div>
  )
}
