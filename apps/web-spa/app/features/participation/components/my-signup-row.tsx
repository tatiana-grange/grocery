import type { MySignup } from '@grocery/openapi-generator/client/types.gen'
import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { useTranslation } from 'react-i18next'
import { formatDeadline, formatSlotWhen } from '@/features/participation/utils/participation-format'

interface MySignupRowProps {
  signup: MySignup
  onLeave: (signup: MySignup) => void
}

/** One of the caller's sign-ups. Leaving is disabled, with the deadline, once it is too late. */
export function MySignupRow({ signup, onLeave }: MySignupRowProps) {
  const { t, i18n } = useTranslation()

  return (
    <li
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4"
      data-testid={`my-signup-${signup.slotId}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold">{signup.roleLabel}</p>
        <p className="text-sm text-muted-foreground">
          {formatSlotWhen(signup.startsAt, signup.endsAt, i18n.language)}
        </p>
        {signup.canLeave ? null : (
          <p className="text-sm text-muted-foreground" data-testid="signup-deadline">
            {t('participation.leaveDeadlinePassed', {
              date: formatDeadline(signup.leaveDeadline, i18n.language),
            })}
          </p>
        )}
      </div>
      {signup.isCancelled ? (
        <Badge variant="destructive" data-testid="signup-cancelled-badge">
          {t('participation.cancelled')}
        </Badge>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        data-testid="signup-leave"
        disabled={!signup.canLeave}
        onClick={() => onLeave(signup)}
      >
        {t('participation.leave')}
      </Button>
    </li>
  )
}
