import { ListPagination } from '@grocery/ui/components/app'
import { Button } from '@grocery/ui/components/primitives/button'
import { Label } from '@grocery/ui/components/primitives/label'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { Switch } from '@grocery/ui/components/primitives/switch'
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
import { SlotFormDialog } from '@/features/admin-participation/components/slot-form-dialog'
import {
  ADMIN_SLOTS_PAGE_SIZE,
  adminSlotsQueryOptions,
} from '@/features/admin-participation/utils/admin-participation-queries'
import { formatSlotDay, formatSlotTimes } from '@/features/participation/utils/participation-format'
import { BackOfficePageHead } from '@/features/common/components/back-office-page-head'
import { BackOfficeStatusBadge } from '@/features/common/components/back-office-status-badge'
import { BackOfficeTableFrame } from '@/features/common/components/back-office-table-frame'
import { useBackOfficePaginationLabels } from '@/features/common/hooks/use-back-office-pagination-labels'
import { useListSearchParams } from '@/hooks/use-list-search-params'

export default function SlotsListPage() {
  const { t, i18n } = useTranslation()
  const { searchParams, page, updateParams } = useListSearchParams()
  const includePast = searchParams.get('past') === '1'
  const [isCreating, setIsCreating] = useState(false)

  const { data, isLoading } = useQuery(adminSlotsQueryOptions({ page, includePast }))
  const total = data?.meta.itemCount ?? 0
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_SLOTS_PAGE_SIZE))
  const paginationLabels = useBackOfficePaginationLabels(page, pageCount)

  return (
    <div className="space-y-6" data-testid="page-slots-list">
      <BackOfficePageHead
        title={t('adminParticipation.title')}
        description={t('adminParticipation.subtitle')}
        actions={
          <Button size="sm" data-testid="slots-new" onClick={() => setIsCreating(true)}>
            <Plus />
            {t('adminParticipation.new')}
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Switch
          id="slots-show-past"
          data-testid="slots-show-past"
          checked={includePast}
          onCheckedChange={(checked) =>
            updateParams({ past: checked ? '1' : undefined, page: undefined })
          }
        />
        <Label htmlFor="slots-show-past">{t('adminParticipation.showPast')}</Label>
      </div>

      <BackOfficeTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('adminParticipation.columns.role')}</TableHead>
              <TableHead>{t('adminParticipation.columns.day')}</TableHead>
              <TableHead>{t('adminParticipation.columns.times')}</TableHead>
              <TableHead>{t('adminParticipation.columns.places')}</TableHead>
              <TableHead>{t('adminParticipation.columns.status')}</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, index) => (
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
                  data-testid="slots-empty"
                >
                  {t('adminParticipation.empty')}
                </TableCell>
              </TableRow>
            )}

            {data?.data.map((slot) => (
              <TableRow key={slot.id} data-testid={`slot-row-${slot.id}`}>
                <TableCell className="font-medium">{slot.roleLabel}</TableCell>
                <TableCell>{formatSlotDay(slot.startsAt, i18n.language)}</TableCell>
                <TableCell>{formatSlotTimes(slot.startsAt, slot.endsAt, i18n.language)}</TableCell>
                <TableCell className="tabular-nums" data-testid="row-count">
                  {t('adminParticipation.taken', {
                    taken: slot.signedUpCount,
                    places: slot.places,
                  })}
                </TableCell>
                <TableCell>
                  {slot.isCancelled ? (
                    <BackOfficeStatusBadge tone="negative" data-testid="row-cancelled-badge">
                      {t('participation.cancelled')}
                    </BackOfficeStatusBadge>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="row-open"
                    render={<Link to={`/admin/slots/${slot.id}`} />}
                  >
                    {t('adminParticipation.open')}
                  </Button>
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
        testIdPrefix="slots"
        count={t('adminParticipation.count', { count: total })}
        {...paginationLabels}
      />

      {isCreating ? <SlotFormDialog onClose={() => setIsCreating(false)} /> : null}
    </div>
  )
}
