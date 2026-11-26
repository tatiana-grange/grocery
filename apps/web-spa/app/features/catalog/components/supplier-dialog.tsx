import type { CatalogSupplier as Supplier } from '@grocery/openapi-generator/client/types.gen'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Dialog,
  DialogContent,
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
  FormMessage,
} from '@grocery/ui/components/primitives/form'
import { Input } from '@grocery/ui/components/primitives/input'
import { SegmentedControl } from '@grocery/ui/components/primitives/segmented-control'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { createSupplier, updateSupplier } from '@/features/catalog/utils/catalog-queries'
import {
  createSupplierFormSchema,
  SUPPLIER_TYPES,
  type SupplierFormValues,
  supplierFormDefaults,
} from '@/features/catalog/utils/supplier-form'

interface SupplierDialogProps {
  supplier?: Supplier
  onSaved: () => void
}

/** Creates a supplier, or edits its name, its type and the address its orders are sent to. */
export function SupplierDialog({ supplier, onSaved }: SupplierDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={supplier ? 'outline' : 'default'}
            size="sm"
            data-testid={supplier ? 'supplier-edit' : 'supplier-new'}
          />
        }
      >
        {supplier ? t('catalog.edit') : t('catalog.suppliers.new')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {supplier ? t('catalog.suppliers.edit') : t('catalog.suppliers.new')}
          </DialogTitle>
        </DialogHeader>
        <SupplierForm
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

interface SupplierFormProps {
  supplier?: Supplier
  onCancel: () => void
  onSaved: () => void
}

function SupplierForm({ supplier, onCancel, onSaved }: SupplierFormProps) {
  const { t } = useTranslation()
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(createSupplierFormSchema(t)),
    defaultValues: supplierFormDefaults(supplier),
    mode: 'onChange',
  })

  const mutation = useMutation({
    mutationFn: (values: SupplierFormValues) => {
      const name = values.name.trim()
      const address = values.contactEmail.trim()
      return supplier
        ? updateSupplier(supplier.id, {
            name,
            type: values.type,
            // An emptied address is sent as null, which clears it; left out, the API keeps it.
            contactEmail: address || null,
            version: supplier.version,
          })
        : createSupplier({ name, type: values.type, contactEmail: address || undefined })
    },
    onSuccess: () => {
      toast.success(t('catalog.toasts.saved'))
      onSaved()
    },
    onError: () => toast.error(t('catalog.toasts.error')),
  })

  return (
    <Form {...form}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('catalog.suppliers.name')}</FormLabel>
              <FormControl>
                <Input data-testid="supplier-name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('catalog.suppliers.type')}</FormLabel>
              <SegmentedControl
                value={field.value}
                onChange={field.onChange}
                options={SUPPLIER_TYPES.map((option) => ({
                  value: option,
                  label: t(`catalog.supplierType.${option}`),
                  testId: `supplier-type-${option}`,
                }))}
              />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contactEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('catalog.suppliers.contactEmail')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  data-testid="supplier-contact-email"
                  placeholder={t('catalog.suppliers.contactEmailPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            data-testid="supplier-save"
            disabled={!form.formState.isValid || mutation.isPending}
          >
            {t('catalog.save')}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
