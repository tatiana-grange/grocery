import {
  adminAccountingControllerDownloadExport,
  adminAccountingControllerGetProfitAndLoss,
  adminExpensesControllerCancel,
  adminExpensesControllerList,
  adminExpensesControllerRecord,
} from '@grocery/openapi-generator/client/sdk.gen'
import { zExportName } from '@grocery/openapi-generator/client/zod.gen'
import type {
  AdminAccountingControllerDownloadExportData,
  AdminExpensesControllerRecordData,
  Expense,
  ExpenseList,
  ProfitAndLoss,
} from '@grocery/openapi-generator/client/types.gen'
import type { QueryClient, UseQueryOptions } from '@tanstack/react-query'
import type { Period } from '@/features/admin-accounting/hooks/use-period'
import { downloadFile } from '@/features/common/lib/download-file'
import { unwrap } from '@/lib/api-client'

export const EXPENSES_PAGE_SIZE = 50

/** Every key the accounting screens cache starts with this, so one call refreshes them all. */
export const ADMIN_ACCOUNTING_QUERY_KEY = 'admin-accounting'

export type ExportName = AdminAccountingControllerDownloadExportData['path']['exportName']
export const EXPORT_NAMES: readonly ExportName[] = zExportName.options

/** An expense recorded or cancelled changes the list and the profit-and-loss account. */
export function invalidateAccounting(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [ADMIN_ACCOUNTING_QUERY_KEY] })
}

export function expensesQueryOptions({
  period,
  page,
}: {
  period: Period
  page: number
}): UseQueryOptions<ExpenseList> {
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

export function profitAndLossQueryOptions(period: Period): UseQueryOptions<ProfitAndLoss> {
  return {
    queryKey: [ADMIN_ACCOUNTING_QUERY_KEY, 'profit-and-loss', period.from, period.to],
    queryFn: async () => unwrap(await adminAccountingControllerGetProfitAndLoss({ query: period })),
  }
}

export async function recordExpense(
  body: AdminExpensesControllerRecordData['body'],
): Promise<Expense> {
  return unwrap(await adminExpensesControllerRecord({ body }))
}

export async function cancelExpense(expenseId: string, reason: string): Promise<Expense> {
  return unwrap(await adminExpensesControllerCancel({ path: { expenseId }, body: { reason } }))
}

/** The file name the API sends in `Content-Disposition`, e.g. `attachment; filename="a.csv"`. */
function readFileName(contentDisposition: string | null): string | null {
  return contentDisposition?.match(/filename="([^"]+)"/)?.[1] ?? null
}

export async function downloadExport(exportName: ExportName, period: Period): Promise<void> {
  const result = await adminAccountingControllerDownloadExport({
    path: { exportName },
    query: period,
    parseAs: 'text',
  })
  const csv = unwrap(result)
  const fileName =
    readFileName(result.response.headers.get('content-disposition')) ?? `${exportName}.csv`
  downloadFile(fileName, csv, 'text/csv;charset=utf-8')
}
