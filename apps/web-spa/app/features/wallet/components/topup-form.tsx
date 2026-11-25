import { SectionTitle } from '@grocery/ui/components/app'
import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { apiErrorCode } from '@/features/common/lib/api-error'
import { startTopup, topupOptionsQueryOptions } from '@/features/wallet/utils/wallet-queries'

const ERROR_CODES = [
  'amount_too_low',
  'amount_too_high',
  'amount_invalid',
  'member_not_active',
  'payments_disabled',
  'provider_unavailable',
]

/**
 * Adds money to the member's own account through the payment provider. It shows nothing when
 * online payment is off. On success the browser leaves for the provider's page.
 */
export function TopupForm() {
  const { t } = useTranslation()
  const { data: options } = useQuery(topupOptionsQueryOptions())
  const [amount, setAmount] = useState('')

  const mutation = useMutation({
    mutationFn: () => startTopup(Number(amount)),
    onSuccess: (topup) => {
      if (topup.redirectUrl) window.location.assign(topup.redirectUrl)
    },
  })

  if (!options?.enabled) return null

  const code = apiErrorCode(mutation.error)
  const isLeaving = mutation.isPending || mutation.isSuccess

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <section
      className="space-y-3 rounded-lg border border-border p-4"
      data-testid="wallet-topup-form"
    >
      <SectionTitle>{t('wallet.topup.title')}</SectionTitle>

      <form className="space-y-3" noValidate onSubmit={handleSubmit}>
        <div className="flex flex-wrap gap-2">
          {options.quickAmountsEur.map((quickAmount) => (
            <Button
              key={quickAmount}
              type="button"
              size="sm"
              variant={Number(amount) === quickAmount ? 'default' : 'outline'}
              data-testid={`wallet-topup-quick-${quickAmount}`}
              onClick={() => setAmount(String(quickAmount))}
            >
              {t('wallet.topup.quick', { value: quickAmount })}
            </Button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-base">
          <span className="font-semibold">{t('wallet.topup.amount')}</span>
          <Input
            className="w-40 text-base tabular-nums"
            data-testid="wallet-topup-amount"
            type="number"
            step={0.01}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <span className="text-sm text-muted-foreground">
            {t('wallet.topup.bounds', { min: options.minAmountEur, max: options.maxAmountEur })}
          </span>
        </label>

        {mutation.isError ? (
          <p className="text-base text-destructive" role="alert" data-testid="wallet-topup-error">
            {code && ERROR_CODES.includes(code)
              ? t(`wallet.topup.error.${code}`, {
                  min: options.minAmountEur,
                  max: options.maxAmountEur,
                })
              : t('error.default')}
          </p>
        ) : null}

        <Button type="submit" data-testid="wallet-topup-submit" disabled={isLeaving}>
          {isLeaving ? t('wallet.topup.submitting') : t('wallet.topup.submit')}
        </Button>
      </form>

      <p className="text-base text-muted-foreground">{t('wallet.topup.note')}</p>
    </section>
  )
}
