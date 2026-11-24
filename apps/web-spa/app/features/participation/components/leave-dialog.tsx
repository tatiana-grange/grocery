import type { MySignup } from '@grocery/openapi-generator/client/types.gen'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/features/common/components/confirm-dialog'
import { formatSlotDay, formatSlotTimes } from '@/features/participation/utils/participation-format'
import {
  leaveSlot,
  PARTICIPATION_QUERY_KEY,
} from '@/features/participation/utils/participation-queries'
import { getParticipationRefusalMessage } from '@/features/participation/utils/participation-refusal'

interface LeaveDialogProps {
  signup: MySignup
  onClose: () => void
}

/** Asks the member to confirm before they give their place back. */
export function LeaveDialog({ signup, onClose }: LeaveDialogProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => leaveSlot(signup.slotId),
    onSuccess: () => toast.success(t('participation.leaveDone')),
    onError: (error) => toast.error(getParticipationRefusalMessage(error, t) ?? t('error.default')),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [PARTICIPATION_QUERY_KEY] })
      onClose()
    },
  })

  return (
    <ConfirmDialog
      testId="leave"
      title={t('participation.leaveDialog.title')}
      description={t('participation.leaveDialog.description', {
        role: signup.roleLabel,
        day: formatSlotDay(signup.startsAt, i18n.language),
        times: formatSlotTimes(signup.startsAt, signup.endsAt, i18n.language),
      })}
      backLabel={t('common.cancel')}
      confirmLabel={t('participation.leaveDialog.confirm')}
      isPending={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    />
  )
}
