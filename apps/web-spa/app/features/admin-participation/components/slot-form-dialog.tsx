import type { AdminSlot } from '@grocery/openapi-generator/client/types.gen'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@grocery/ui/components/primitives/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@grocery/ui/components/primitives/form'
import { Input } from '@grocery/ui/components/primitives/input'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  ADMIN_PARTICIPATION_QUERY_KEY,
  createSlot,
  updateSlot,
} from '@/features/admin-participation/utils/admin-participation-queries'
import {
  createSlotFormSchema,
  MAX_PLACES,
  type SlotFormValues,
  toDateInput,
  toInstant,
  toTimeInput,
} from '@/features/admin-participation/utils/slot-form'
import { PARTICIPATION_QUERY_KEY } from '@/features/participation/utils/participation-queries'
import { participationRefusalMessage } from '@/features/participation/utils/participation-refusal'

interface SlotFormDialogProps {
  /** The slot to edit. Leave it out to create a new one. */
  slot?: AdminSlot
  onClose: () => void
}

function initialValues(slot?: AdminSlot): SlotFormValues {
  if (!slot) return { roleLabel: '', date: '', startTime: '', endTime: '', places: '1' }
  return {
    roleLabel: slot.roleLabel,
    date: toDateInput(slot.startsAt),
    startTime: toTimeInput(slot.startsAt),
    endTime: toTimeInput(slot.endsAt),
    places: String(slot.places),
  }
}

/**
 * Creates a slot, or edits one. The date and the times are read and written in the browser's time
 * zone. Once somebody is signed up, they are locked and the slot keeps its exact start and end.
 */
export function SlotFormDialog({ slot, onClose }: SlotFormDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [refusal, setRefusal] = useState<string | null>(null)
  const isLocked = slot !== undefined && slot.signedUpCount > 0

  const form = useForm<SlotFormValues>({
    resolver: zodResolver(createSlotFormSchema(t)),
    defaultValues: initialValues(slot),
  })

  const mutation = useMutation({
    mutationFn: (values: SlotFormValues) => {
      const body = {
        roleLabel: values.roleLabel.trim(),
        places: Number(values.places),
        startsAt: isLocked ? slot.startsAt : toInstant(values.date, values.startTime),
        endsAt: isLocked ? slot.endsAt : toInstant(values.date, values.endTime),
      }
      return slot ? updateSlot(slot.id, body) : createSlot(body)
    },
    onSuccess: () => {
      toast.success(
        slot ? t('adminParticipation.form.updated') : t('adminParticipation.form.created'),
      )
      void queryClient.invalidateQueries({ queryKey: [ADMIN_PARTICIPATION_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: [PARTICIPATION_QUERY_KEY] })
      onClose()
    },
    onError: (error) => setRefusal(participationRefusalMessage(error, t) ?? t('error.default')),
  })

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-testid="slot-form-dialog">
        <DialogHeader>
          <DialogTitle>
            {slot ? t('adminParticipation.form.editTitle') : t('adminParticipation.form.newTitle')}
          </DialogTitle>
          <DialogDescription>{t('adminParticipation.form.description')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => {
              setRefusal(null)
              mutation.mutate(values)
            })}
          >
            <FormField
              control={form.control}
              name="roleLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminParticipation.form.roleLabel')}</FormLabel>
                  <FormControl>
                    <Input data-testid="slot-form-role" maxLength={120} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminParticipation.form.date')}</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      data-testid="slot-form-date"
                      disabled={isLocked}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('adminParticipation.form.startTime')}</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        data-testid="slot-form-start"
                        disabled={isLocked}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('adminParticipation.form.endTime')}</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        data-testid="slot-form-end"
                        disabled={isLocked}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {isLocked ? (
              <p className="text-sm text-muted-foreground" data-testid="slot-form-locked">
                {t('adminParticipation.form.locked')}
              </p>
            ) : null}
            <FormField
              control={form.control}
              name="places"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminParticipation.form.places')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={MAX_PLACES}
                      className="w-32"
                      data-testid="slot-form-places"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {refusal ? (
              <p className="text-sm text-destructive" data-testid="slot-form-error">
                {refusal}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                data-testid="slot-form-cancel"
                onClick={onClose}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" data-testid="slot-form-submit" disabled={mutation.isPending}>
                {slot ? t('adminParticipation.form.save') : t('adminParticipation.form.create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
