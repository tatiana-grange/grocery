import type { MySignup } from '@grocery/openapi-generator/client/types.gen'
import { PageTitle } from '@grocery/ui/components/app'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LeaveDialog } from '@/features/participation/components/leave-dialog'
import { MySignupRow } from '@/features/participation/components/my-signup-row'
import { SlotCard } from '@/features/participation/components/slot-card'
import { participationRefusalMessage } from '@/features/participation/utils/participation-refusal'
import {
  comingSlotsQueryOptions,
  mySignupsQueryOptions,
  PARTICIPATION_QUERY_KEY,
  signUpToSlot,
} from '@/features/participation/utils/participation-queries'

export default function ParticipationPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [leaving, setLeaving] = useState<MySignup | null>(null)
  const coming = useQuery(comingSlotsQueryOptions())
  const mine = useQuery(mySignupsQueryOptions())

  const signUp = useMutation({
    mutationFn: signUpToSlot,
    onSuccess: () => toast.success(t('participation.signUpDone')),
    onError: (error) => toast.error(participationRefusalMessage(error, t) ?? t('error.default')),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [PARTICIPATION_QUERY_KEY] }),
  })

  return (
    <div className="space-y-8" data-testid="page-participation">
      <div>
        <PageTitle>{t('participation.title')}</PageTitle>
        <p className="text-sm text-muted-foreground">{t('participation.subtitle')}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{t('participation.mine.title')}</h2>
        {mine.isLoading ? <Skeleton className="h-16 w-full" /> : null}
        {mine.data?.data.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="my-signups-empty">
            {t('participation.mine.empty')}
          </p>
        ) : null}
        <ul className="space-y-2">
          {mine.data?.data.map((signup) => (
            <MySignupRow key={signup.slotId} signup={signup} onLeave={setLeaving} />
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{t('participation.coming.title')}</h2>
        {coming.isLoading ? <Skeleton className="h-16 w-full" /> : null}
        {coming.data?.data.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="coming-slots-empty">
            {t('participation.coming.empty')}
          </p>
        ) : null}
        <ul className="space-y-2">
          {coming.data?.data.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              isPending={signUp.isPending}
              onSignUp={(slotId) => signUp.mutate(slotId)}
            />
          ))}
        </ul>
      </section>

      {leaving ? <LeaveDialog signup={leaving} onClose={() => setLeaving(null)} /> : null}
    </div>
  )
}
