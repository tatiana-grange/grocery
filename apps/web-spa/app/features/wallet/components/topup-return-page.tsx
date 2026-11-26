import { PageTitle } from '@grocery/ui/components/app'
import { Button } from '@grocery/ui/components/primitives/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import {
  ownWalletQueryOptions,
  topupQueryOptions,
  verifyTopup,
} from '@/features/wallet/utils/wallet-queries'

const POLL_INTERVAL_MS = 3000
const POLL_LIMIT_MS = 2 * 60 * 1000

/**
 * Where the payer lands after the provider. Nothing in the address is trusted except the top-up
 * id: the state shown is what our API says after asking the provider.
 */
export default function TopupReturnPage() {
  const [searchParams] = useSearchParams()
  const topupId = searchParams.get('topup')
  if (!topupId) return <Navigate to="/account" replace />
  return <TopupResult topupId={topupId} />
}

function TopupResult({ topupId }: { topupId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [startedAt] = useState(() => Date.now())

  const recheck = useMutation({
    mutationFn: () => verifyTopup(topupId),
    onSuccess: (topup) => queryClient.setQueryData(['topup', topupId], topup),
  })

  // Once on load. The ref keeps the dev double-run from asking the provider twice. A failure
  // is left to the polling and to the "check again" button.
  const hasVerified = useRef(false)
  useEffect(() => {
    if (hasVerified.current) return
    hasVerified.current = true
    verifyTopup(topupId)
      .then((topup) => queryClient.setQueryData(['topup', topupId], topup))
      .catch(() => undefined)
  }, [topupId, queryClient])

  const { data: topup, isError } = useQuery({
    ...topupQueryOptions(topupId),
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' && Date.now() - startedAt < POLL_LIMIT_MS
        ? POLL_INTERVAL_MS
        : false,
  })

  const isPaid = topup?.status === 'paid'
  const { data: wallet } = useQuery({ ...ownWalletQueryOptions(), enabled: isPaid })
  useEffect(() => {
    if (isPaid) void queryClient.invalidateQueries({ queryKey: ['wallet'] })
  }, [isPaid, queryClient])

  const eur = (value: number) => t('wallet.eur', { value: value.toFixed(2) })

  return (
    <div className="space-y-6" data-testid="page-topup-return">
      <PageTitle>{t('wallet.topup.title')}</PageTitle>

      {isPaid && topup ? (
        <section className="space-y-2" data-testid="topup-return-credited">
          <p className="text-base">
            {t('wallet.topup.return.credited', { amount: eur(topup.amountEur) })}
          </p>
          {wallet ? (
            <p className="text-base text-muted-foreground">
              {t('wallet.topup.return.balance')}:{' '}
              <span className="font-semibold tabular-nums" data-testid="topup-return-balance">
                {eur(wallet.balanceEur)}
              </span>
            </p>
          ) : null}
          <Button variant="outline" onClick={() => navigate('/account')}>
            {t('wallet.title')}
          </Button>
        </section>
      ) : null}

      {topup?.status === 'failed' || topup?.status === 'expired' ? (
        <section
          className="space-y-3"
          data-testid={topup.status === 'failed' ? 'topup-return-failed' : 'topup-return-expired'}
        >
          <p>{t(`wallet.topup.return.${topup.status}`)}</p>
          <Button data-testid="topup-return-retry" onClick={() => navigate('/account')}>
            {t('wallet.topup.return.retry')}
          </Button>
        </section>
      ) : null}

      {!topup || topup.status === 'pending' ? (
        <section className="space-y-3" data-testid="topup-return-checking">
          <p>{isError ? t('error.default') : t('wallet.topup.return.checking')}</p>
          <Button
            variant="outline"
            data-testid="topup-return-check-again"
            disabled={recheck.isPending}
            onClick={() => recheck.mutate()}
          >
            {t('wallet.topup.return.checkAgain')}
          </Button>
        </section>
      ) : null}
    </div>
  )
}
