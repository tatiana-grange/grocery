import { PageTitle, SectionTitle } from '@grocery/ui/components/app'
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
import { useMutation, useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PeriodPicker } from '@/features/admin-accounting/components/period-picker'
import { formatCents } from '@/features/admin-accounting/utils/accounting-format'
import {
  downloadExport,
  EXPORT_NAMES,
  type ExportName,
  profitAndLossQueryOptions,
} from '@/features/admin-accounting/utils/admin-accounting-queries'
import { usePeriod } from '@/features/admin-accounting/hooks/use-period'

interface FigureRowProps {
  label: string
  cents: number
  testId: string
  /** A subtotal or the result: shown in bold. */
  strong?: boolean
  /** A line under a group, shown inset. */
  inset?: boolean
}

function FigureRow({ label, cents, testId, strong, inset }: FigureRowProps) {
  return (
    <TableRow className={strong ? 'font-semibold' : undefined}>
      <TableCell className={inset ? 'pl-8' : undefined}>{label}</TableCell>
      <TableCell className="text-right tabular-nums" data-testid={testId}>
        {formatCents(cents)}
      </TableCell>
    </TableRow>
  )
}

export default function ProfitAndLossPage() {
  const { t } = useTranslation()
  const { period, setPeriod } = usePeriod()
  const { data, isLoading } = useQuery(profitAndLossQueryOptions(period))

  const exportMutation = useMutation({
    mutationFn: (exportName: ExportName) => downloadExport(exportName, period),
    onError: () => toast.error(t('error.default')),
  })

  return (
    <div className="space-y-6" data-testid="page-profit-and-loss">
      <div>
        <PageTitle>{t('adminAccounting.pnl.title')}</PageTitle>
        <p className="text-sm text-muted-foreground">{t('adminAccounting.pnl.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodPicker period={period} onChange={setPeriod} />
        <Button
          variant="ghost"
          size="sm"
          data-testid="pnl-to-expenses"
          render={<Link to={`/admin/accounting/expenses?from=${period.from}&to=${period.to}`} />}
        >
          {t('adminAccounting.pnl.toExpenses')}
        </Button>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('adminAccounting.pnl.figure')}</TableHead>
              <TableHead className="text-right">{t('adminAccounting.columns.amount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || !data ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={2}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <>
                <FigureRow
                  label={t('adminAccounting.pnl.sales')}
                  cents={data.salesCents}
                  testId="pnl-sales"
                />
                <FigureRow
                  label={t('adminAccounting.pnl.costOfGoodsSold')}
                  cents={data.costOfGoodsSoldCents}
                  testId="pnl-cost-of-goods"
                />
                <FigureRow
                  strong
                  label={t('adminAccounting.pnl.grossMargin')}
                  cents={data.grossMarginCents}
                  testId="pnl-gross-margin"
                />
                <FigureRow
                  label={t('adminAccounting.pnl.membershipFees')}
                  cents={data.membershipFeesCents}
                  testId="pnl-fees"
                />
                {data.expensesByCategory.map((line) => (
                  <FigureRow
                    inset
                    key={line.category}
                    label={t(`adminAccounting.category.${line.category}`)}
                    cents={line.amountCents}
                    testId={`pnl-expense-${line.category}`}
                  />
                ))}
                <FigureRow
                  strong
                  label={t('adminAccounting.pnl.expensesTotal')}
                  cents={data.expensesTotalCents}
                  testId="pnl-expenses-total"
                />
                <FigureRow
                  strong
                  label={t('adminAccounting.pnl.result')}
                  cents={data.resultCents}
                  testId="pnl-result"
                />
              </>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">{t('adminAccounting.pnl.walletNote')}</p>

      <section className="space-y-3" data-testid="pnl-exports">
        <SectionTitle>{t('adminAccounting.exports.title')}</SectionTitle>
        <p className="text-sm text-muted-foreground">{t('adminAccounting.exports.description')}</p>
        <div className="flex flex-wrap gap-2">
          {EXPORT_NAMES.map((exportName) => (
            <Button
              key={exportName}
              variant="outline"
              size="sm"
              data-testid={`export-${exportName}`}
              disabled={exportMutation.isPending}
              onClick={() => exportMutation.mutate(exportName)}
            >
              <Download className="mr-2 size-4" />
              {t(`adminAccounting.exports.${exportName}`)}
            </Button>
          ))}
        </div>
      </section>
    </div>
  )
}
