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
import { useNavigate } from 'react-router'
import {
  ADMIN_PARTICIPATION_QUERY_KEY,
  deleteSlot,
} from '@/features/admin-participation/utils/admin-participation-queries'
import { PARTICIPATION_QUERY_KEY } from '@/features/participation/utils/participation-queries'
import { participationRefusalMessage } from '@/features/participation/utils/participation-refusal'

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
      void queryClient.invalidateQueries({ queryKey: [ADMIN_PARTICIPATION_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: [PARTICIPATION_QUERY_KEY] })
      navigate('/admin/slots')
    },
    onError: (error) => {
      toast.error(participationRefusalMessage(error, t) ?? t('error.default'))
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-testid="delete-slot-dialog">
        <DialogHeader>
          <DialogTitle>{t('adminParticipation.delete.title')}</DialogTitle>
          <DialogDescription>{t('adminParticipation.delete.description')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" data-testid="delete-slot-back" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            data-testid="delete-slot-confirm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t('adminParticipation.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
