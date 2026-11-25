import { ListPagination } from '@grocery/ui/components/app'
import type { Expense } from '@grocery/openapi-generator/client/types.gen'
import { Button } from '@grocery/ui/components/primitives/button'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@grocery/ui/components/primitives/table'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CancelExpenseDialog } from '@/features/admin-accounting/components/cancel-expense-dialog'
import { PeriodPicker } from '@/features/admin-accounting/components/period-picker'
import { RecordExpenseDialog } from '@/features/admin-accounting/components/record-expense-dialog'
import { formatCents, formatDay } from '@/features/admin-accounting/utils/accounting-format'
import {
  EXPENSES_PAGE_SIZE,
  expensesQueryOptions,
} from '@/features/admin-accounting/utils/admin-accounting-queries'
import { periodSearch, usePeriod } from '@/features/admin-accounting/hooks/use-period'
import { BackOfficePageHead } from '@/features/common/components/back-office-page-head'
import { BackOfficeStatusBadge } from '@/features/common/components/back-office-status-badge'
import { BackOfficeTableFrame } from '@/features/common/components/back-office-table-frame'
import { useBackOfficePaginationLabels } from '@/features/common/hooks/use-back-office-pagination-labels'
import { useListSearchParams } from '@/hooks/use-list-search-params'

export default function ExpensesPage() {
  const { t, i18n } = useTranslation()
  const { period, setPeriod } = usePeriod()
  const { page, updateParams } = useListSearchParams()
  const [isRecording, setIsRecording] = useState(false)
  const [cancelling, setCancelling] = useState<Expense | null>(null)

  const { data, isLoading } = useQuery(expensesQueryOptions({ period, page }))
  const total = data?.meta.itemCount ?? 0
  const pageCount = Math.max(1, Math.ceil(total / EXPENSES_PAGE_SIZE))
  const paginationLabels = useBackOfficePaginationLabels(page, pageCount)

  return (
    <div className="space-y-6" data-testid="page-expenses">
      <BackOfficePageHead
        title={t('adminAccounting.expenses.title')}
        description={t('adminAccounting.expenses.subtitle')}
        actions={
          <Button size="sm" data-testid="expenses-new" onClick={() => setIsRecording(true)}>
            <Plus />
            {t('adminAccounting.expenses.new')}
          </Button>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodPicker period={period} onChange={setPeriod} />
        <Button
          variant="outline"
          size="sm"
          data-testid="expenses-to-profit-and-loss"
          render={<Link to={`/admin/accounting${periodSearch(period)}`} />}
        >
          {t('adminAccounting.expenses.toProfitAndLoss')}
        </Button>
      </div>

      <BackOfficeTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('adminAccounting.columns.day')}</TableHead>
              <TableHead>{t('adminAccounting.columns.category')}</TableHead>
              <TableHead>{t('adminAccounting.columns.label')}</TableHead>
              <TableHead>{t('adminAccounting.columns.method')}</TableHead>
              <TableHead className="text-right">{t('adminAccounting.columns.amount')}</TableHead>
              <TableHead>{t('adminAccounting.columns.recordedBy')}</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && data?.data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-muted-foreground"
                  data-testid="expenses-empty"
                >
                  {t('adminAccounting.expenses.empty')}
                </TableCell>
              </TableRow>
            )}

            {data?.data.map((expense) => (
              <TableRow key={expense.id} data-testid={`expense-row-${expense.id}`}>
                <TableCell className="tabular-nums">
                  {formatDay(expense.spentOn, i18n.language)}
                </TableCell>
                <TableCell>{t(`adminAccounting.category.${expense.category}`)}</TableCell>
                <TableCell>
                  <div className="font-medium">{expense.label}</div>
                  {expense.kind === 'cancellation' ? (
                    <div className="text-sm text-muted-foreground" data-testid="expense-reason">
                      {t('adminAccounting.expenses.cancellationOf')} {expense.reason}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>{t(`adminAccounting.method.${expense.paymentMethod}`)}</TableCell>
                <TableCell className="text-right tabular-nums" data-testid="expense-amount">
                  {formatCents(expense.amountCents)}
                </TableCell>
                <TableCell>{expense.recordedByName}</TableCell>
                <TableCell>
                  {expense.isCancelled ? (
                    <BackOfficeStatusBadge tone="negative" data-testid="expense-cancelled-badge">
                      {t('adminAccounting.expenses.cancelled')}
                    </BackOfficeStatusBadge>
                  ) : null}
                  {expense.kind === 'expense' && !expense.isCancelled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="expense-cancel"
                      onClick={() => setCancelling(expense)}
                    >
                      {t('adminAccounting.expenses.cancel')}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </BackOfficeTableFrame>

      <ListPagination
        page={page}
        pageCount={pageCount}
        onPageChange={(next) => updateParams({ page: String(next) })}
        testIdPrefix="expenses"
        count={t('adminAccounting.expenses.count', { count: total })}
        {...paginationLabels}
      />

      {isRecording ? <RecordExpenseDialog onClose={() => setIsRecording(false)} /> : null}
      {cancelling ? (
        <CancelExpenseDialog expense={cancelling} onClose={() => setCancelling(null)} />
      ) : null}
    </div>
  )
}
