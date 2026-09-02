import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { Textarea } from '@grocery/ui/components/primitives/textarea'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import {
  categoriesQueryOptions,
  createProduct,
  suppliersQueryOptions,
} from '@/features/catalog/utils/catalog-queries'

const LABELS = ['organic', 'local', 'vegetarian', 'vegan'] as const

export default function ProductFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: suppliers } = useQuery(suppliersQueryOptions())
  const { data: categories } = useQuery(categoriesQueryOptions())

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [saleMode, setSaleMode] = useState<'unit' | 'weight'>('unit')
  const [labels, setLabels] = useState<string[]>([])
  const [priceEur, setPriceEur] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      createProduct({
        name,
        description: description || undefined,
        supplierId,
        categoryId,
        saleMode,
        labels: labels as ('organic' | 'local' | 'vegetarian' | 'vegan')[],
        photos: [],
        initialPriceEur: Number(priceEur),
      }),
    onSuccess: (product) => {
      toast.success(t('catalog.toasts.saved'))
      navigate(`/admin/catalog/products/${product.id}`)
    },
    onError: () => toast.error(t('catalog.toasts.error')),
  })

  const canSubmit = name.trim() && supplierId && categoryId && Number(priceEur) > 0

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" render={<Link to="/admin/catalog" />}>
        <ArrowLeft className="mr-2 size-4" />
        {t('catalog.backToCatalogue')}
      </Button>
      <h1 className="text-2xl font-black tracking-tight">{t('catalog.products.new')}</h1>

      <div className="max-w-lg space-y-4">
        <Field label={t('catalog.products.name')}>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label={t('catalog.products.description')}>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field label={t('catalog.products.supplier')}>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
          >
            <option value="">—</option>
            {suppliers?.data.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('catalog.products.category')}>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">—</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('catalog.products.saleMode')}>
          <div className="flex gap-2">
            {(['unit', 'weight'] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                variant={saleMode === mode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSaleMode(mode)}
              >
                {t(`catalog.saleMode.${mode}`)}
              </Button>
            ))}
          </div>
        </Field>
        <Field
          label={
            saleMode === 'weight'
              ? t('catalog.products.pricePerKg')
              : t('catalog.products.pricePerPiece')
          }
        >
          <Input
            type="number"
            step="0.01"
            value={priceEur}
            onChange={(event) => setPriceEur(event.target.value)}
          />
        </Field>
        <Field label={t('catalog.products.labels')}>
          <div className="flex flex-wrap gap-2">
            {LABELS.map((label) => (
              <Button
                key={label}
                type="button"
                variant={labels.includes(label) ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  setLabels((current) =>
                    current.includes(label)
                      ? current.filter((item) => item !== label)
                      : [...current, label],
                  )
                }
              >
                {t(`catalog.label.${label}`)}
              </Button>
            ))}
          </div>
        </Field>

        <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
          {t('catalog.save')}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}
