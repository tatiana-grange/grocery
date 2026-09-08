import { ListPagination, PageTitle } from '@grocery/ui/components/app'
import { Badge } from '@grocery/ui/components/primitives/badge'
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
import { Tabs, TabsList, TabsTrigger } from '@grocery/ui/components/primitives/tabs'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  SUPPLIER_ORDERS_PAGE_SIZE,
  supplierOrdersListQueryOptions,
} from '@/features/admin-purchasing/utils/purchasing-queries'
import { useListSearchParams } from '@/hooks/use-list-search-params'

const STATUS_TABS = ['all', 'draft', 'sent', 'received', 'closed'] as const

export default function SupplierOrdersListPage() {
  const { t } = useTranslation()
  const { searchParams, page, updateParams } = useListSearchParams()
  const status = (searchParams.get('status') ?? 'all') as (typeof STATUS_TABS)[number]

  const { data, isLoading } = useQuery(
    supplierOrdersListQueryOptions({ page, status: status === 'all' ? undefined : status }),
  )

  const total = data?.meta.itemCount ?? 0
  const pageCount = Math.max(1, Math.ceil(total / SUPPLIER_ORDERS_PAGE_SIZE))

  return (
    <div className="space-y-6" data-testid="page-supplier-orders-list">
      <div>
        <PageTitle>{t('purchasing.title')}</PageTitle>
        <p className="text-sm text-muted-foreground">{t('purchasing.subtitle')}</p>
      </div>

      <Tabs
        value={status}
        onValueChange={(value) => updateParams({ status: value, page: undefined })}
      >
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} data-testid={`supplier-orders-tab-${tab}`}>
              {t(`purchasing.status.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('purchasing.columns.supplier')}</TableHead>
              <TableHead>{t('purchasing.columns.status')}</TableHead>
              <TableHead className="text-right">{t('purchasing.columns.lines')}</TableHead>
              <TableHead className="text-right">{t('purchasing.columns.estimatedTotal')}</TableHead>
              <TableHead>{t('purchasing.columns.createdAt')}</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && data?.data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                  data-testid="supplier-orders-empty"
                >
                  {t('purchasing.empty')}
                </TableCell>
              </TableRow>
            )}

            {data?.data.map((order) => (
              <TableRow key={order.id} data-testid={`supplier-orders-row-${order.id}`}>
                <TableCell className="font-medium">{order.supplier.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" data-testid="supplier-orders-row-status">
                    {t(`purchasing.status.${order.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{order.lineCount}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {t('purchasing.estimatedTotalValue', {
                    value: order.estimatedTotalEur.toFixed(2),
                  })}
                  {order.hasUnknownCostLines ? ' *' : ''}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="supplier-orders-row-open"
                    render={<Link to={`/admin/purchasing/supplier-orders/${order.id}`} />}
                  >
                    {t('purchasing.open')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ListPagination
        page={page}
        pageCount={pageCount}
        onPageChange={(next) => updateParams({ page: String(next) })}
        testIdPrefix="supplier-orders"
        count={t('purchasing.count', { count: total })}
      />
    </div>
  )
}
