import { ProductOrderingMode } from '@grocery/openapi-generator/client/types.gen'
import { PageTitle } from '@grocery/ui/components/app'
import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { NativeSelect } from '@grocery/ui/components/primitives/native-select'
import { SegmentedControl } from '@grocery/ui/components/primitives/segmented-control'
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

// Derived from the generated client's enum instead of a hand-copied literal tuple, so a new
// ordering mode added server-side shows up here without a forgotten manual update.
const ORDERING_MODES = Object.values(ProductOrderingMode)

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
  const [selectionUnit, setSelectionUnit] = useState<'g' | 'kg'>('kg')
  const [stepGrams, setStepGrams] = useState('100')
  const [orderingMode, setOrderingMode] = useState<ProductOrderingMode>('in_store')
  const [labels, setLabels] = useState<Label[]>([])
  const [priceEur, setPriceEur] = useState('')

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setDescription(existing.description ?? '')
      setSupplierId(existing.supplier.id)
      setCategoryId(existing.category.id)
      setSaleMode(existing.saleMode)
      setSelectionUnit(existing.selectionUnit ?? 'kg')
      setStepGrams(String(existing.quantityStepGrams ?? 100))
      setOrderingMode(existing.orderingMode)
      setLabels(existing.labels)
    }
  }, [existing])

  // The by-weight picker settings only travel to the API for a by-weight product; `null` clears
  // them otherwise so a product switched away from weight doesn't keep a stale step.
  const weightPicker =
    saleMode === 'weight'
      ? { selectionUnit, quantityStepGrams: Number(stepGrams) }
      : { selectionUnit: null, quantityStepGrams: null }

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
            ...weightPicker,
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
            ...weightPicker,
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

  const stepValid =
    saleMode !== 'weight' || (Number.isInteger(Number(stepGrams)) && Number(stepGrams) > 0)
  const canSubmit =
    name.trim() && supplierId && categoryId && stepValid && (isEdit || Number(priceEur) > 0)

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
      <PageTitle>{isEdit ? t('catalog.products.edit') : t('catalog.products.new')}</PageTitle>

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
          <NativeSelect
            className="w-full"
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
          </NativeSelect>
        </Field>
        <Field label={t('catalog.products.category')}>
          <NativeSelect
            className="w-full"
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
          </NativeSelect>
        </Field>
        <Field label={t('catalog.products.saleMode')}>
          {isEdit ? (
            <p className="text-sm text-muted-foreground" data-testid="product-form-salemode-locked">
              {t(`catalog.saleMode.${saleMode}`)} · {t('catalog.products.saleModeLocked')}
            </p>
          ) : (
            <SegmentedControl
              value={saleMode}
              onChange={setSaleMode}
              options={(['unit', 'weight'] as const).map((mode) => ({
                value: mode,
                label: t(`catalog.saleMode.${mode}`),
                testId: `product-form-salemode-${mode}`,
              }))}
            />
          )}
        </Field>
        {saleMode === 'weight' && (
          <>
            <Field label={t('catalog.products.selectionUnit')}>
              <SegmentedControl
                value={selectionUnit}
                onChange={setSelectionUnit}
                options={(['g', 'kg'] as const).map((unit) => ({
                  value: unit,
                  label: unit,
                  testId: `product-form-selectionunit-${unit}`,
                }))}
              />
            </Field>
            <Field label={t('catalog.products.quantityStep')}>
              <Input
                type="number"
                step="1"
                min="1"
                data-testid="product-form-step-grams"
                value={stepGrams}
                onChange={(event) => setStepGrams(event.target.value)}
              />
            </Field>
          </>
        )}
        <Field label={t('catalog.products.orderingMode')}>
          <SegmentedControl
            wrap
            value={orderingMode}
            onChange={setOrderingMode}
            options={ORDERING_MODES.map((mode) => ({
              value: mode,
              label: t(`catalog.orderingMode.${mode}`),
              testId: `product-form-orderingmode-${mode}`,
            }))}
          />
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
          <SegmentedControl
            wrap
            value={labels}
            onChange={(label) =>
              setLabels((current) =>
                current.includes(label)
                  ? current.filter((item) => item !== label)
                  : [...current, label],
              )
            }
            options={LABELS.map((label) => ({
              value: label,
              label: t(`catalog.label.${label}`),
            }))}
          />
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
