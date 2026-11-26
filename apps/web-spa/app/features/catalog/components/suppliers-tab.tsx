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
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { aggregateSupplierPreOrders } from '@/features/admin-purchasing/utils/purchasing-queries'
import {
  archiveSupplier,
  suppliersQueryOptions,
  unarchiveSupplier,
} from '@/features/catalog/utils/catalog-queries'
import { NextOrderLine } from '@/features/catalog/components/next-order-line'
import { SupplierDialog } from '@/features/catalog/components/supplier-dialog'
import { SupplierScheduleDialog } from '@/features/catalog/components/supplier-schedule-dialog'
import { BackOfficeStatusBadge } from '@/features/common/components/back-office-status-badge'
import { BackOfficeTableFrame } from '@/features/common/components/back-office-table-frame'
import { isConflict } from '@/features/common/lib/api-error'

export function SuppliersTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery(suppliersQueryOptions())

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['catalog'] })
  }

  const archive = useMutation({
    mutationFn: ({ id, cascade }: { id: string; cascade?: boolean }) =>
      archiveSupplier(id, cascade),
    onSuccess: () => {
      toast.success(t('catalog.toasts.archived'))
      invalidate()
    },
    onError: (error: unknown) => {
      const count = (error as { activeProductCount?: number })?.activeProductCount
      if (count) {
        if (window.confirm(t('catalog.suppliers.cascadeConfirm', { count }))) {
          archive.mutate({ id: archive.variables!.id, cascade: true })
        }
        return
      }
      toast.error(t('catalog.toasts.error'))
    },
  })

  const unarchive = useMutation({
    mutationFn: (id: string) => unarchiveSupplier(id),
    onSuccess: invalidate,
  })

  const navigate = useNavigate()
  const aggregate = useMutation({
    mutationFn: (supplierId: string) => aggregateSupplierPreOrders(supplierId),
    onSuccess: (result) => {
      toast.success(t('purchasing.aggregate.done'))
      void queryClient.invalidateQueries({ queryKey: ['admin-purchasing'] })
      navigate(`/admin/purchasing/supplier-orders/${result.supplierOrder.id}`, {
        state: { skippedLines: result.skippedLines },
      })
    },
    onError: (error: unknown) => {
      toast.error(
        isConflict(error) ? t('purchasing.aggregate.nothingPending') : t('catalog.toasts.error'),
      )
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SupplierDialog onSaved={invalidate} />
      </div>

      <BackOfficeTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('catalog.suppliers.name')}</TableHead>
              <TableHead>{t('catalog.suppliers.type')}</TableHead>
              <TableHead>{t('catalog.suppliers.products')}</TableHead>
              <TableHead>{t('catalog.suppliers.nextOrder')}</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((supplier) => (
              <TableRow key={supplier.id} data-testid={`supplier-row-${supplier.name}`}>
                <TableCell className="font-medium">
                  {supplier.name}
                  {supplier.archivedAt && (
                    <BackOfficeStatusBadge
                      tone="neutral"
                      className="ml-2"
                      data-testid="supplier-archived-badge"
                    >
                      {t('catalog.archived')}
                    </BackOfficeStatusBadge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" data-testid="supplier-row-type">
                    {t(`catalog.supplierType.${supplier.type}`)}
                  </Badge>
                </TableCell>
                <TableCell>{supplier.productCount}</TableCell>
                <TableCell data-testid="supplier-next-order">
                  {supplier.nextOrder ? <NextOrderLine nextOrder={supplier.nextOrder} /> : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <SupplierDialog supplier={supplier} onSaved={invalidate} />
                    {!supplier.archivedAt && (
                      <SupplierScheduleDialog supplier={supplier} onSaved={invalidate} />
                    )}
                    {!supplier.archivedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="supplier-aggregate"
                        disabled={aggregate.isPending}
                        onClick={() => aggregate.mutate(supplier.id)}
                      >
                        {t('purchasing.aggregate.action')}
                      </Button>
                    )}
                    {supplier.archivedAt ? (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="supplier-unarchive"
                        onClick={() => unarchive.mutate(supplier.id)}
                      >
                        {t('catalog.unarchive')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="supplier-archive"
                        onClick={() => archive.mutate({ id: supplier.id })}
                      >
                        {t('catalog.archive')}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </BackOfficeTableFrame>
    </div>
  )
}
