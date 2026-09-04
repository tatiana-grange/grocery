import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { Textarea } from '@grocery/ui/components/primitives/textarea'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { handleMutationError } from '@/features/common/lib/api-error'
import {
  categoriesQueryOptions,
  createProduct,
  productDetailQueryOptions,
  suppliersQueryOptions,
  updateProduct,
} from '@/features/catalog/utils/catalog-queries'

const LABELS = ['organic', 'local', 'vegetarian', 'vegan'] as const
type Label = (typeof LABELS)[number]

const ORDERING_MODES = ['pre_order', 'in_store', 'both'] as const
type OrderingMode = (typeof ORDERING_MODES)[number]

export default function ProductFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { productId } = useParams()
  const isEdit = Boolean(productId)

  const { data: suppliers } = useQuery(suppliersQueryOptions())
  const { data: categories } = useQuery(categoriesQueryOptions())
  const { data: existing, isLoading } = useQuery({
    ...productDetailQueryOptions(productId ?? ''),
    enabled: isEdit,
  })

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [saleMode, setSaleMode] = useState<'unit' | 'weight'>('unit')
  const [orderingMode, setOrderingMode] = useState<OrderingMode>('in_store')
  const [labels, setLabels] = useState<Label[]>([])
  const [priceEur, setPriceEur] = useState('')

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setDescription(existing.description ?? '')
      setSupplierId(existing.supplier.id)
      setCategoryId(existing.category.id)
      setSaleMode(existing.saleMode)
      setOrderingMode(existing.orderingMode)
      setLabels(existing.labels)
    }
  }, [existing])

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateProduct(productId!, {
            name,
            // Send null (not undefined) when cleared, so the backend actually removes it —
            // `undefined` reads as "leave unchanged".
            description: description.trim() ? description : null,
            supplierId,
            categoryId,
            orderingMode,
            labels,
            version: existing!.version,
          })
        : createProduct({
            name,
            description: description || undefined,
            supplierId,
            categoryId,
            saleMode,
            orderingMode,
            labels,
            photos: [],
            initialPriceEur: Number(priceEur),
          }),
    onSuccess: (product) => {
      toast.success(t('catalog.toasts.saved'))
      void queryClient.invalidateQueries({ queryKey: ['catalog'] })
      navigate(`/admin/catalog/products/${product.id}`)
    },
    onError: (error) =>
      handleMutationError(error, toast.error, {
        conflict: t('common.conflict'),
        fallback: t('catalog.toasts.error'),
      }),
  })

  const canSubmit =
    name.trim() && supplierId && categoryId && (isEdit || Number(priceEur) > 0)

  if (isEdit && isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <div className="space-y-6" data-testid="page-product-form">
      <Button
        variant="ghost"
        size="sm"
        data-testid="product-form-back"
        render={<Link to="/admin/catalog" />}
      >
        <ArrowLeft className="mr-2 size-4" />
        {t('catalog.backToCatalogue')}
      </Button>
      <h1 className="text-2xl font-black tracking-tight">
        {isEdit ? t('catalog.products.edit') : t('catalog.products.new')}
      </h1>

      <div className="max-w-lg space-y-4">
        <Field label={t('catalog.products.name')}>
          <Input
            data-testid="product-form-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label={t('catalog.products.description')}>
          <Textarea
            data-testid="product-form-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <Field label={t('catalog.products.supplier')}>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            data-testid="product-form-supplier"
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
            data-testid="product-form-category"
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
          {isEdit ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="product-form-salemode-locked"
            >
              {t(`catalog.saleMode.${saleMode}`)} · {t('catalog.products.saleModeLocked')}
            </p>
          ) : (
            <div className="flex gap-2">
              {(['unit', 'weight'] as const).map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  data-testid={`product-form-salemode-${mode}`}
                  variant={saleMode === mode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSaleMode(mode)}
                >
                  {t(`catalog.saleMode.${mode}`)}
                </Button>
              ))}
            </div>
          )}
        </Field>
        <Field label={t('catalog.products.orderingMode')}>
          <div className="flex flex-wrap gap-2">
            {ORDERING_MODES.map((mode) => (
              <Button
                key={mode}
                type="button"
                data-testid={`product-form-orderingmode-${mode}`}
                variant={orderingMode === mode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOrderingMode(mode)}
              >
                {t(`catalog.orderingMode.${mode}`)}
              </Button>
            ))}
          </div>
        </Field>
        {!isEdit && (
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
              data-testid="product-form-price"
              value={priceEur}
              onChange={(event) => setPriceEur(event.target.value)}
            />
          </Field>
        )}
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

        <Button
          data-testid="product-form-submit"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
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
