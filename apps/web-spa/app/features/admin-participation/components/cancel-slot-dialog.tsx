import type { AdminSlotDetail } from '@grocery/openapi-generator/client/types.gen'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  cancelSlot,
  invalidateParticipation,
} from '@/features/admin-participation/utils/admin-participation-queries'
import { ConfirmDialog } from '@/features/common/components/confirm-dialog'
import { getParticipationRefusalMessage } from '@/features/participation/utils/participation-refusal'

interface CancelSlotDialogProps {
  slot: AdminSlotDetail
  onClose: () => void
}

/** Cancelling is final, and the dialog says so before the admin confirms. */
export function CancelSlotDialog({ slot, onClose }: CancelSlotDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => cancelSlot(slot.id),
    onSuccess: () => toast.success(t('adminParticipation.cancel.done')),
    onError: (error) => toast.error(getParticipationRefusalMessage(error, t) ?? t('error.default')),
    onSettled: () => {
      invalidateParticipation(queryClient)
      onClose()
    },
  })

  return (
    <ConfirmDialog
      testId="cancel-slot"
      title={t('adminParticipation.cancel.title')}
      description={t('adminParticipation.cancel.warning', { count: slot.signedUpCount })}
      descriptionTestId="cancel-slot-warning"
      backLabel={t('adminParticipation.cancel.keep')}
      confirmLabel={t('adminParticipation.cancel.confirm')}
      destructive
      isPending={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    />
  )
}
