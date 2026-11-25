import type { MemberSlot } from '@grocery/openapi-generator/client/types.gen'
import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { useTranslation } from 'react-i18next'
import { formatSlotWhen } from '@/features/participation/utils/participation-format'

interface SlotCardProps {
  slot: MemberSlot
  isPending: boolean
  onSignUp: (slotId: string) => void
}

/** One coming slot: what it is, when, how many places are left, and the button to take one. */
export function SlotCard({ slot, isPending, onSignUp }: SlotCardProps) {
  const { t, i18n } = useTranslation()
  const isFull = slot.freePlaces === 0

  return (
    <li
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4"
      data-testid={`slot-card-${slot.id}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold">{slot.roleLabel}</p>
        <p className="text-sm text-muted-foreground">
          {formatSlotWhen(slot.startsAt, slot.endsAt, i18n.language)}
        </p>
      </div>
      {isFull ? (
        <Badge variant="secondary" data-testid="slot-full">
          {t('participation.full')}
        </Badge>
      ) : (
        <span className="text-sm tabular-nums" data-testid="slot-places">
          {t('participation.placesLeft', { count: slot.freePlaces })}
        </span>
      )}
      <Button
        size="sm"
        data-testid="slot-signup"
        disabled={slot.isSignedUp || isFull || isPending}
        onClick={() => onSignUp(slot.id)}
      >
        {slot.isSignedUp ? t('participation.signedUp') : t('participation.signUp')}
      </Button>
    </li>
  )
}
