import { PageTitle } from '@grocery/ui/components/app'
import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Trash2, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { AddMemberDialog } from '@/features/admin-participation/components/add-member-dialog'
import { CancelSlotDialog } from '@/features/admin-participation/components/cancel-slot-dialog'
import { DeleteSlotDialog } from '@/features/admin-participation/components/delete-slot-dialog'
import { SlotFormDialog } from '@/features/admin-participation/components/slot-form-dialog'
import {
  ADMIN_PARTICIPATION_QUERY_KEY,
  adminSlotDetailQueryOptions,
  removeMember,
} from '@/features/admin-participation/utils/admin-participation-queries'
import { formatSlotDay, formatSlotTimes } from '@/features/participation/utils/participation-format'
import { PARTICIPATION_QUERY_KEY } from '@/features/participation/utils/participation-queries'
import { participationRefusalMessage } from '@/features/participation/utils/participation-refusal'

type OpenDialog = 'edit' | 'cancel' | 'delete' | 'add-member' | null

export default function SlotDetailPage() {
  const { t, i18n } = useTranslation()
  const { slotId = '' } = useParams()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const { data: slot, isLoading } = useQuery(adminSlotDetailQueryOptions(slotId))

  const removal = useMutation({
    mutationFn: (memberId: string) => removeMember(slotId, memberId),
    onSuccess: () => toast.success(t('adminParticipation.detail.removed')),
    onError: (error) => toast.error(participationRefusalMessage(error, t) ?? t('error.default')),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [ADMIN_PARTICIPATION_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: [PARTICIPATION_QUERY_KEY] })
    },
  })

  if (isLoading || !slot) {
    return <Skeleton className="h-64 w-full" data-testid="slot-detail-loading" />
  }

  const hasEnded = new Date(slot.endsAt).getTime() <= Date.now()
  const canChange = !slot.isCancelled && !hasEnded

  return (
    <div className="space-y-6" data-testid="page-slot-detail">
      <Button
        variant="ghost"
        size="sm"
        data-testid="slot-detail-back"
        render={<Link to="/admin/slots" />}
      >
        <ArrowLeft className="mr-2 size-4" />
        {t('adminParticipation.backToList')}
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageTitle>{slot.roleLabel}</PageTitle>
          <p className="text-sm text-muted-foreground">
            {formatSlotDay(slot.startsAt, i18n.language)},{' '}
            {formatSlotTimes(slot.startsAt, slot.endsAt, i18n.language)}
          </p>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <span className="tabular-nums" data-testid="slot-detail-count">
              {t('adminParticipation.taken', { taken: slot.signedUpCount, places: slot.places })}
            </span>
            {slot.isCancelled ? (
              <Badge variant="destructive" data-testid="slot-detail-cancelled">
                {t('participation.cancelled')}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canChange ? (
            <>
              <Button
                size="sm"
                variant="outline"
                data-testid="slot-detail-edit"
                onClick={() => setDialog('edit')}
              >
                <Pencil className="mr-2 size-4" />
                {t('adminParticipation.detail.edit')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                data-testid="slot-detail-cancel"
                onClick={() => setDialog('cancel')}
              >
                {t('adminParticipation.detail.cancel')}
              </Button>
            </>
          ) : null}
          {slot.signedUpCount === 0 ? (
            <Button
              size="sm"
              variant="destructive"
              data-testid="slot-detail-delete"
              onClick={() => setDialog('delete')}
            >
              <Trash2 className="mr-2 size-4" />
              {t('adminParticipation.detail.delete')}
            </Button>
          ) : null}
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('adminParticipation.detail.signups')}</h2>
          {canChange ? (
            <Button
              size="sm"
              data-testid="slot-detail-add-member"
              onClick={() => setDialog('add-member')}
            >
              <UserPlus className="mr-2 size-4" />
              {t('adminParticipation.detail.addMember')}
            </Button>
          ) : null}
        </div>
        <ul className="space-y-2" data-testid="slot-detail-signups">
          {slot.signups.length === 0 ? (
            <li className="text-sm text-muted-foreground" data-testid="slot-detail-no-signups">
              {t('adminParticipation.detail.noSignups')}
            </li>
          ) : null}
          {slot.signups.map((signup) => (
            <li
              key={signup.memberId}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
              data-testid={`signup-row-${signup.memberId}`}
            >
              <span className="font-medium">{signup.memberName}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {signup.membershipNumber}
              </span>
              {hasEnded ? null : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  data-testid="signup-remove"
                  disabled={removal.isPending}
                  onClick={() => removal.mutate(signup.memberId)}
                >
                  <X className="mr-2 size-4" />
                  {t('adminParticipation.detail.remove')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {dialog === 'edit' ? <SlotFormDialog slot={slot} onClose={() => setDialog(null)} /> : null}
      {dialog === 'cancel' ? (
        <CancelSlotDialog slot={slot} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'delete' ? (
        <DeleteSlotDialog slot={slot} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'add-member' ? (
        <AddMemberDialog slot={slot} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  )
}
