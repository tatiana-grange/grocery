import type { MySignup } from '@grocery/openapi-generator/client/types.gen'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@grocery/ui/components/primitives/dialog'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { formatSlotDay, formatSlotTimes } from '@/features/participation/utils/participation-format'
import { participationRefusalMessage } from '@/features/participation/utils/participation-refusal'
import {
  leaveSlot,
  PARTICIPATION_QUERY_KEY,
} from '@/features/participation/utils/participation-queries'

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
    onSuccess: () => {
      toast.success(t('participation.leaveDone'))
      void queryClient.invalidateQueries({ queryKey: [PARTICIPATION_QUERY_KEY] })
      onClose()
    },
    onError: (error) => {
      toast.error(participationRefusalMessage(error, t) ?? t('error.default'))
      void queryClient.invalidateQueries({ queryKey: [PARTICIPATION_QUERY_KEY] })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-testid="leave-dialog">
        <DialogHeader>
          <DialogTitle>{t('participation.leaveDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('participation.leaveDialog.description', {
              role: signup.roleLabel,
              day: formatSlotDay(signup.startsAt, i18n.language),
              times: formatSlotTimes(signup.startsAt, signup.endsAt, i18n.language),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" data-testid="leave-cancel" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            data-testid="leave-confirm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t('participation.leaveDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
