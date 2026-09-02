import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MemberQr } from '@/features/account/components/member-qr'
import { PasswordChangeForm } from '@/features/account/components/password-change-form'
import {
  myAccountQueryOptions,
  updateMyProfile,
} from '@/features/account/utils/account-queries'

const FIELDS = ['addressLine1', 'addressLine2', 'postalCode', 'city', 'phone'] as const

export default function AccountPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: account, isLoading } = useQuery(myAccountQueryOptions())

  const [profile, setProfile] = useState<Record<string, string>>({})
  useEffect(() => {
    if (account) {
      setProfile(
        Object.fromEntries(FIELDS.map((field) => [field, account.profile[field] ?? ''])),
      )
    }
  }, [account])

  const mutation = useMutation({
    mutationFn: () =>
      updateMyProfile({
        ...Object.fromEntries(
          Object.entries(profile).map(([key, value]) => [key, value || null]),
        ),
        version: account!.version,
      }),
    onSuccess: () => {
      toast.success(t('members.account.saved'))
      void queryClient.invalidateQueries({ queryKey: ['members', 'me'] })
    },
    onError: () => toast.error(t('members.account.error')),
  })

  if (isLoading || !account) return <Skeleton className="h-96 w-full" />

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight">{t('members.account.title')}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant={account.status === 'active' ? 'default' : 'secondary'}>
            {t(`members.status.${account.status}`)}
          </Badge>
          <span>·</span>
          <span>
            {t('members.account.fee')}: {t(`members.feeState.${account.fee.state}`)}
            {account.fee.expectedAmountCents > 0 && (
              <>
                {' '}
                ({(account.fee.paidAmountCents / 100).toFixed(2)} /{' '}
                {(account.fee.expectedAmountCents / 100).toFixed(2)} €)
              </>
            )}
          </span>
        </div>
      </div>

      <div className="grid gap-8 sm:grid-cols-[1fr_auto]">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {t('members.account.personalDetails')}
          </h2>
          {FIELDS.map((field) => (
            <label key={field} className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {t(`members.account.${field}`)}
              </span>
              <Input
                value={profile[field] ?? ''}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, [field]: event.target.value }))
                }
              />
            </label>
          ))}
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {t('members.account.save')}
          </Button>
        </section>

        <MemberQr membershipNumber={account.membershipNumber} />
      </div>

      <PasswordChangeForm />
    </div>
  )
}
