import { Button } from '@grocery/ui/components/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@grocery/ui/components/primitives/dialog'
import type { ReactNode } from 'react'

interface ConfirmDialogProps {
  /** Prefix of the test ids: `<testId>-dialog`, `<testId>-back`, `<testId>-confirm`. */
  testId: string
  title: string
  description: ReactNode
  descriptionTestId?: string
  backLabel: string
  confirmLabel: string
  destructive?: boolean
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}

/** A yes-or-no question asked before an action, open as long as it is rendered. */
export function ConfirmDialog({
  testId,
  title,
  description,
  descriptionTestId,
  backLabel,
  confirmLabel,
  destructive = false,
  isPending,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-testid={`${testId}-dialog`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription data-testid={descriptionTestId}>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" data-testid={`${testId}-back`} onClick={onClose}>
            {backLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            data-testid={`${testId}-confirm`}
            disabled={isPending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
