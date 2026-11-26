import type { CatalogCategory as Category } from '@grocery/openapi-generator/client/types.gen'
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
  archiveCategory,
  categoriesQueryOptions,
  createCategory,
  unarchiveCategory,
  updateCategory,
} from '@/features/catalog/utils/catalog-queries'
import { BackOfficeStatusBadge } from '@/features/common/components/back-office-status-badge'
import { BackOfficeTableFrame } from '@/features/common/components/back-office-table-frame'

export function CategoriesTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery(categoriesQueryOptions())
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['catalog'] })

  const archive = useMutation({
    mutationFn: (id: string) => archiveCategory(id),
    onSuccess: () => {
      toast.success(t('catalog.toasts.archived'))
      invalidate()
    },
    onError: (error: unknown) => {
      const count = (error as { productCount?: number })?.productCount
      toast.error(count ? t('catalog.categories.blocked', { count }) : t('catalog.toasts.error'))
    },
  })
  const unarchive = useMutation({
    mutationFn: (id: string) => unarchiveCategory(id),
    onSuccess: invalidate,
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CategoryDialog onSaved={invalidate} />
      </div>
      <BackOfficeTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('catalog.categories.name')}</TableHead>
              <TableHead>{t('catalog.suppliers.products')}</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            )}
            {data?.map((category) => (
              <TableRow key={category.id} data-testid={`category-row-${category.name}`}>
                <TableCell className="font-medium">
                  {category.name}
                  {category.archivedAt && (
                    <BackOfficeStatusBadge
                      tone="neutral"
                      className="ml-2"
                      data-testid="category-archived-badge"
                    >
                      {t('catalog.archived')}
                    </BackOfficeStatusBadge>
                  )}
                </TableCell>
                <TableCell>{category.productCount}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <CategoryDialog category={category} onSaved={invalidate} />
                    {category.archivedAt ? (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="category-unarchive"
                        onClick={() => unarchive.mutate(category.id)}
                      >
                        {t('catalog.unarchive')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="category-archive"
                        onClick={() => archive.mutate(category.id)}
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

function CategoryDialog({ category, onSaved }: { category?: Category; onSaved: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState(category?.name ?? '')

  const mutation = useMutation({
    mutationFn: () =>
      category
        ? updateCategory(category.id, { name, version: category.version })
        : createCategory({ name }),
    onSuccess: () => {
      toast.success(t('catalog.toasts.saved'))
      onSaved()
    },
    onError: () => toast.error(t('catalog.toasts.error')),
  })

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant={category ? 'outline' : 'default'}
            size="sm"
            data-testid={category ? 'category-edit' : 'category-new'}
          />
        }
      >
        {category ? t('catalog.edit') : t('catalog.categories.new')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {category ? t('catalog.categories.edit') : t('catalog.categories.new')}
          </DialogTitle>
        </DialogHeader>
        <Input
          data-testid="category-name"
          placeholder={t('catalog.categories.name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t('common.cancel')}</DialogClose>
          <DialogClose
            render={<Button data-testid="category-save" />}
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
