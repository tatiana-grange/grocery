import type { AdminSlotDetail } from '@grocery/openapi-generator/client/types.gen'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import {
  deleteSlot,
  invalidateParticipation,
} from '@/features/admin-participation/utils/admin-participation-queries'
import { ConfirmDialog } from '@/features/common/components/confirm-dialog'
import { getParticipationRefusalMessage } from '@/features/participation/utils/participation-refusal'

interface DeleteSlotDialogProps {
  slot: AdminSlotDetail
  onClose: () => void
}

/** Deletes a slot nobody is signed up for, then goes back to the list. */
export function DeleteSlotDialog({ slot, onClose }: DeleteSlotDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: () => deleteSlot(slot.id),
    onSuccess: () => {
      toast.success(t('adminParticipation.delete.done'))
      invalidateParticipation(queryClient)
      navigate('/admin/slots')
    },
    onError: (error) => {
      toast.error(getParticipationRefusalMessage(error, t) ?? t('error.default'))
      onClose()
    },
  })

  return (
    <ConfirmDialog
      testId="delete-slot"
      title={t('adminParticipation.delete.title')}
      description={t('adminParticipation.delete.description')}
      backLabel={t('common.cancel')}
      confirmLabel={t('adminParticipation.delete.confirm')}
      destructive
      isPending={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    />
  )
}
