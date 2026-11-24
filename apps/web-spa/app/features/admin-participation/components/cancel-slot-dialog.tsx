import type { AdminSlotDetail } from '@grocery/openapi-generator/client/types.gen'
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
import {
  ADMIN_PARTICIPATION_QUERY_KEY,
  cancelSlot,
} from '@/features/admin-participation/utils/admin-participation-queries'
import { PARTICIPATION_QUERY_KEY } from '@/features/participation/utils/participation-queries'
import { participationRefusalMessage } from '@/features/participation/utils/participation-refusal'

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
    onError: (error) => toast.error(participationRefusalMessage(error, t) ?? t('error.default')),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [ADMIN_PARTICIPATION_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: [PARTICIPATION_QUERY_KEY] })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-testid="cancel-slot-dialog">
        <DialogHeader>
          <DialogTitle>{t('adminParticipation.cancel.title')}</DialogTitle>
          <DialogDescription data-testid="cancel-slot-warning">
            {t('adminParticipation.cancel.warning', { count: slot.signedUpCount })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" data-testid="cancel-slot-back" onClick={onClose}>
            {t('adminParticipation.cancel.keep')}
          </Button>
          <Button
            variant="destructive"
            data-testid="cancel-slot-confirm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t('adminParticipation.cancel.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
