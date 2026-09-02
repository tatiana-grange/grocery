import type { CatalogSupplier as Supplier } from '@grocery/openapi-generator/client/types.gen'
import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@grocery/ui/components/primitives/dialog'
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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  archiveSupplier,
  createSupplier,
  suppliersQueryOptions,
  unarchiveSupplier,
  updateSupplier,
} from '@/features/catalog/utils/catalog-queries'

export function SuppliersTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery(suppliersQueryOptions())

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['catalog'] })
  }

  const archive = useMutation({
    mutationFn: ({ id, cascade }: { id: string; cascade?: boolean }) => archiveSupplier(id, cascade),
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SupplierDialog onSaved={invalidate} />
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('catalog.suppliers.name')}</TableHead>
              <TableHead>{t('catalog.suppliers.type')}</TableHead>
              <TableHead>{t('catalog.suppliers.products')}</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((supplier) => (
              <TableRow key={supplier.id} className={supplier.archivedAt ? 'opacity-50' : ''}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{t(`catalog.supplierType.${supplier.type}`)}</Badge>
                </TableCell>
                <TableCell>{supplier.productCount}</TableCell>
                <TableCell className="flex gap-1">
                  <SupplierDialog supplier={supplier} onSaved={invalidate} />
                  {supplier.archivedAt ? (
                    <Button variant="ghost" size="sm" onClick={() => unarchive.mutate(supplier.id)}>
                      {t('catalog.unarchive')}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => archive.mutate({ id: supplier.id })}
                    >
                      {t('catalog.archive')}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function SupplierDialog({ supplier, onSaved }: { supplier?: Supplier; onSaved: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState(supplier?.name ?? '')
  const [type, setType] = useState<'producer' | 'wholesaler'>(supplier?.type ?? 'producer')

  const mutation = useMutation({
    mutationFn: () =>
      supplier
        ? updateSupplier(supplier.id, { name, type, version: supplier.version })
        : createSupplier({ name, type }),
    onSuccess: () => {
      toast.success(t('catalog.toasts.saved'))
      onSaved()
    },
    onError: () => toast.error(t('catalog.toasts.error')),
  })

  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant={supplier ? 'ghost' : 'default'} size="sm" />}
      >
        {supplier ? t('catalog.edit') : t('catalog.suppliers.new')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {supplier ? t('catalog.suppliers.edit') : t('catalog.suppliers.new')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder={t('catalog.suppliers.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex gap-2">
            {(['producer', 'wholesaler'] as const).map((option) => (
              <Button
                key={option}
                type="button"
                variant={type === option ? 'default' : 'outline'}
                size="sm"
                onClick={() => setType(option)}
              >
                {t(`catalog.supplierType.${option}`)}
              </Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t('common.cancel')}</DialogClose>
          <DialogClose
            render={<Button />}
            disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t('catalog.save')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
