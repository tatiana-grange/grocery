import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ownWalletQueryOptions } from '@/features/wallet/utils/wallet-queries'

/**
 * Tells a member whose balance is below zero why they cannot order, and what to do about it.
 * Renders nothing otherwise. It reads the member's own wallet, so the cart page and the account
 * page share one cached answer.
 */
export function NegativeBalanceNotice() {
  const { t } = useTranslation()
  const { data } = useQuery(ownWalletQueryOptions())

  if (!data || data.balanceEur >= 0) return null

  return (
    <div
      className="flex items-start gap-3 rounded-xl border-2 border-warning bg-warning/10 p-4 text-base text-foreground"
      data-testid="negative-balance-notice"
    >
      <AlertTriangle className="size-6 shrink-0" />
      <span>{t('wallet.negative.member')}</span>
    </div>
  )
}
