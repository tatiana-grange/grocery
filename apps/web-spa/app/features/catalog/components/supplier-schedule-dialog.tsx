import type { CatalogSupplier as Supplier } from '@grocery/openapi-generator/client/types.gen'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@grocery/ui/components/primitives/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@grocery/ui/components/primitives/form'
import { NativeSelect } from '@grocery/ui/components/primitives/native-select'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { Switch } from '@grocery/ui/components/primitives/switch'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { NextOrderLine } from '@/features/catalog/components/next-order-line'
import { updateSupplier } from '@/features/catalog/utils/catalog-queries'
import {
  ISO_WEEKDAYS,
  MONTH_WEEKS,
  missingScheduleFields,
  SENDING_HOURS,
  type ScheduleFormValues,
  scheduleFormDefaults,
  scheduleFormSchema,
  toSchedulePayload,
  WEEK_PARITIES,
  weekdayName,
} from '@/features/catalog/utils/supplier-form'

interface SupplierScheduleDialogProps {
  supplier: Supplier
  onSaved: () => void
}

/** Sets when the app sends this supplier its order by itself. */
export function SupplierScheduleDialog({ supplier, onSaved }: SupplierScheduleDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" data-testid="supplier-schedule-edit" />}
      >
        {t('catalog.suppliers.schedule.action')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('catalog.suppliers.schedule.title', { name: supplier.name })}
          </DialogTitle>
          <DialogDescription>{t('catalog.suppliers.schedule.description')}</DialogDescription>
        </DialogHeader>
        <ScheduleForm
          supplier={supplier}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            setOpen(false)
            onSaved()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

interface ScheduleFormProps {
  supplier: Supplier
  onCancel: () => void
  onSaved: () => void
}

function ScheduleForm({ supplier, onCancel, onSaved }: ScheduleFormProps) {
  const { t, i18n } = useTranslation()
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: scheduleFormDefaults(supplier.orderSchedule),
    mode: 'onChange',
  })
  const values = form.watch()
  const missing = missingScheduleFields(values)

  const mutation = useMutation({
    mutationFn: (formValues: ScheduleFormValues) =>
      updateSupplier(supplier.id, {
        orderSchedule: toSchedulePayload(formValues),
        version: supplier.version,
      }),
    onSuccess: () => {
      toast.success(t('catalog.suppliers.schedule.saved'))
      onSaved()
    },
    onError: () => toast.error(t('catalog.toasts.error')),
  })

  const weekdayOptions = ISO_WEEKDAYS.map((weekday) => (
    <option key={weekday} value={weekday}>
      {weekdayName(weekday, i18n.language)}
    </option>
  ))
  const placeholder = <option value="">{t('catalog.suppliers.schedule.choose')}</option>

  return (
    <Form {...form}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((formValues) => mutation.mutate(formValues))}
      >
        <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3">
              <Switch
                data-testid="schedule-enabled"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
              <FormLabel>{t('catalog.suppliers.schedule.enabled')}</FormLabel>
            </FormItem>
          )}
        />

        {values.enabled && (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog.suppliers.schedule.fields.frequency')}</FormLabel>
                  <FormControl>
                    <NativeSelect data-testid="schedule-frequency" {...field}>
                      {placeholder}
                      <option value="weekly">{t('catalog.suppliers.schedule.weekly')}</option>
                      <option value="monthly">{t('catalog.suppliers.schedule.monthly')}</option>
                    </NativeSelect>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="distributionWeekday"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('catalog.suppliers.schedule.fields.distributionWeekday')}
                  </FormLabel>
                  <FormControl>
                    <NativeSelect data-testid="schedule-distribution-weekday" {...field}>
                      {placeholder}
                      {weekdayOptions}
                    </NativeSelect>
                  </FormControl>
                </FormItem>
              )}
            />
            {values.frequency === 'weekly' && (
              <FormField
                control={form.control}
                name="weekParity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('catalog.suppliers.schedule.fields.weekParity')}</FormLabel>
                    <FormControl>
                      <NativeSelect data-testid="schedule-week-parity" {...field}>
                        {placeholder}
                        {WEEK_PARITIES.map((parity) => (
                          <option key={parity} value={parity}>
                            {t(`catalog.suppliers.schedule.parity.${parity}`)}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            {values.frequency === 'monthly' && (
              <FormField
                control={form.control}
                name="monthWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('catalog.suppliers.schedule.fields.monthWeek')}</FormLabel>
                    <FormControl>
                      <NativeSelect data-testid="schedule-month-week" {...field}>
                        {placeholder}
                        {MONTH_WEEKS.map((week) => (
                          <option key={week} value={week}>
                            {t(`catalog.suppliers.schedule.monthWeek.${week}`)}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="sendingWeekday"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog.suppliers.schedule.fields.sendingWeekday')}</FormLabel>
                  <FormControl>
                    <NativeSelect data-testid="schedule-sending-weekday" {...field}>
                      {placeholder}
                      {weekdayOptions}
                    </NativeSelect>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sendingHour"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog.suppliers.schedule.fields.sendingHour')}</FormLabel>
                  <FormControl>
                    <NativeSelect data-testid="schedule-sending-hour" {...field}>
                      {placeholder}
                      {SENDING_HOURS.map((hour) => (
                        <option key={hour} value={hour}>
                          {t('catalog.suppliers.schedule.hourOption', { hour })}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        )}

        {values.enabled && missing.length > 0 && (
          <p className="text-sm text-destructive" data-testid="schedule-missing">
            {t('catalog.suppliers.schedule.missing', {
              fields: missing
                .map((field) => t(`catalog.suppliers.schedule.fields.${field}`))
                .join(', '),
            })}
          </p>
        )}

        {supplier.nextOrder && (
          <p className="text-sm text-muted-foreground" data-testid="schedule-next-order">
            <NextOrderLine nextOrder={supplier.nextOrder} />
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            data-testid="schedule-save"
            disabled={missing.length > 0 || mutation.isPending}
          >
            {t('catalog.save')}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
