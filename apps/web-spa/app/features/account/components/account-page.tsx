import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@grocery/ui/components/primitives/dialog'
import { Input } from '@grocery/ui/components/primitives/input'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { MemberQr } from '@/features/account/components/member-qr'
import { PasswordChangeForm } from '@/features/account/components/password-change-form'
import { handleMutationError } from '@/features/common/lib/api-error'
import {
  endMyMembership,
  myAccountQueryOptions,
  updateMyProfile,
} from '@/features/account/utils/account-queries'
import { authClient } from '@/lib/auth-client'

const FIELDS = ['addressLine1', 'addressLine2', 'postalCode', 'city', 'phone'] as const

export default function AccountPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: account, isLoading, error } = useQuery({
    ...myAccountQueryOptions(),
    retry: false,
  })

  const terminate = useMutation({
    mutationFn: endMyMembership,
    onSuccess: async () => {
      await authClient.signOut()
      navigate('/login')
    },
    onError: () => toast.error(t('members.account.error')),
  })

  const [name, setName] = useState('')
  const [profile, setProfile] = useState<Record<string, string>>({})
  useEffect(() => {
    if (account) {
      setName(account.name)
      setProfile(
        Object.fromEntries(FIELDS.map((field) => [field, account.profile[field] ?? ''])),
      )
    }
  }, [account])

  const mutation = useMutation({
    mutationFn: () =>
      updateMyProfile({
        name: name.trim() || undefined,
        ...Object.fromEntries(
          Object.entries(profile).map(([key, value]) => [key, value || null]),
        ),
        version: account!.version,
      }),
    onSuccess: () => {
      toast.success(t('members.account.saved'))
      void queryClient.invalidateQueries({ queryKey: ['members', 'me'] })
    },
    onError: (error) =>
      handleMutationError(error, toast.error, {
        conflict: t('common.conflict'),
        fallback: t('members.account.error'),
      }),
  })

  if (isLoading) return <Skeleton className="h-96 w-full" />

  if (error || !account) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-black tracking-tight">{t('members.account.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('members.account.notActive')}</p>
        <Button
          variant="outline"
          onClick={async () => {
            await authClient.signOut()
            navigate('/login')
          }}
        >
          {t('members.nav.logOut')}
        </Button>
      </div>
    )
  }

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
          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {t('members.account.name')}
            </span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
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

      <section className="border-t border-border pt-6">
        <Dialog>
          <DialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" />}>
            {t('members.account.endMembership')}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('members.account.endMembershipTitle')}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t('members.account.endMembershipWarning')}
            </p>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t('common.cancel')}</DialogClose>
              <DialogClose
                render={<Button variant="destructive" />}
                disabled={terminate.isPending}
                onClick={() => terminate.mutate()}
              >
                {t('members.account.endMembership')}
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  )
}
