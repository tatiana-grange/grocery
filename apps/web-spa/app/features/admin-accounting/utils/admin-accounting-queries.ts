import {
  adminAccountingControllerDownloadExport,
  adminAccountingControllerGetProfitAndLoss,
  adminExpensesControllerCancel,
  adminExpensesControllerList,
  adminExpensesControllerRecord,
} from '@grocery/openapi-generator/client/sdk.gen'
import type {
  AdminAccountingControllerDownloadExportData,
  AdminExpensesControllerRecordData,
} from '@grocery/openapi-generator/client/types.gen'
import type { QueryClient } from '@tanstack/react-query'
import type { Period } from '@/features/admin-accounting/utils/use-period'
import { unwrap } from '@/lib/api-client'

export const EXPENSES_PAGE_SIZE = 50

/** Every key the accounting screens cache starts with this, so one call refreshes them all. */
export const ADMIN_ACCOUNTING_QUERY_KEY = 'admin-accounting'

export type ExportName = AdminAccountingControllerDownloadExportData['path']['exportName']
export const EXPORT_NAMES: ExportName[] = [
  'wallet-movements',
  'sales',
  'purchases',
  'membership-fees',
  'expenses',
]

/** An expense recorded or cancelled changes the list and the profit-and-loss account. */
export function invalidateAccounting(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [ADMIN_ACCOUNTING_QUERY_KEY] })
}

export function expensesQueryOptions({ period, page }: { period: Period; page: number }) {
  return {
    queryKey: [ADMIN_ACCOUNTING_QUERY_KEY, 'expenses', period.from, period.to, page],
    queryFn: async () =>
      unwrap(
        await adminExpensesControllerList({
          query: {
            from: period.from,
            to: period.to,
            offset: (page - 1) * EXPENSES_PAGE_SIZE,
            pageSize: EXPENSES_PAGE_SIZE,
          },
        }),
      ),
  }
}

export function profitAndLossQueryOptions(period: Period) {
  return {
    queryKey: [ADMIN_ACCOUNTING_QUERY_KEY, 'profit-and-loss', period.from, period.to],
    queryFn: async () => unwrap(await adminAccountingControllerGetProfitAndLoss({ query: period })),
  }
}

export async function recordExpense(body: AdminExpensesControllerRecordData['body']) {
  return unwrap(await adminExpensesControllerRecord({ body }))
}

/** Cancelling is final: the expense stays, and a reversing row names it. */
export async function cancelExpense(expenseId: string, reason: string) {
  return unwrap(await adminExpensesControllerCancel({ path: { expenseId }, body: { reason } }))
}

/** Fetches one CSV file for the period and hands it to the browser as a download. */
export async function downloadExport(exportName: ExportName, period: Period) {
  const csv = unwrap(
    await adminAccountingControllerDownloadExport({
      path: { exportName },
      query: period,
      parseAs: 'text',
    }),
  )
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `grocery-${exportName}-${period.from}-${period.to}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
