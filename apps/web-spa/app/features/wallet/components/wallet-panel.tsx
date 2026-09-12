import { Badge } from '@grocery/ui/components/primitives/badge'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import type { Wallet } from '@grocery/openapi-generator/client/types.gen'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ownWalletQueryOptions } from '@/features/wallet/utils/wallet-queries'

interface WalletPanelProps {
  /** Pass a wallet to render it directly; omit it to load the caller's own. */
  wallet?: Wallet
}

/**
 * A balance and the movements behind it. The balance is never a stored number — it is the sum
 * of the rows listed underneath it, which is exactly why both are shown together.
 */
export function WalletPanel({ wallet }: WalletPanelProps) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({ ...ownWalletQueryOptions(), enabled: !wallet })
  const shown = wallet ?? data

  if (!shown) {
    return isLoading ? <Skeleton className="h-40 w-full" /> : null
  }

  const eur = (value: number) => t('wallet.eur', { value: value.toFixed(2) })

  return (
    <section className="space-y-4 rounded-lg border border-border p-4" data-testid="wallet-panel">
      <div className="flex items-baseline gap-3">
        <h2 className="font-semibold">{t('wallet.title')}</h2>
        <span className="ml-auto text-sm text-muted-foreground">{t('wallet.balance')}</span>
        <span className="text-2xl font-semibold tabular-nums" data-testid="wallet-balance">
          {eur(shown.balanceEur)}
        </span>
      </div>

      <div data-testid="wallet-history">
        {shown.entries.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('wallet.empty')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.entries.data.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-3 py-2 text-sm"
                data-testid={`wallet-entry-${entry.id}`}
              >
                <span className="text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </span>
                <Badge variant="secondary">{t(`wallet.reason.${entry.reason}`)}</Badge>
                {entry.paymentMethod ? (
                  <span className="text-muted-foreground">
                    {t(`wallet.method_.${entry.paymentMethod}`)}
                  </span>
                ) : null}
                {entry.note ? <span className="text-muted-foreground">{entry.note}</span> : null}
                <span
                  className={`ml-auto tabular-nums ${entry.amountEur < 0 ? 'text-destructive' : ''}`}
                >
                  {eur(entry.amountEur)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
