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
  /** Disables the confirm button on top of `isPending`, for example until a field is filled. */
  confirmDisabled?: boolean
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
  /** Shown between the question and the buttons, for a field the answer needs. */
  children?: ReactNode
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
  confirmDisabled = false,
  isPending,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-testid={`${testId}-dialog`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription data-testid={descriptionTestId}>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" data-testid={`${testId}-back`} onClick={onClose}>
            {backLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            data-testid={`${testId}-confirm`}
            disabled={isPending || confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
