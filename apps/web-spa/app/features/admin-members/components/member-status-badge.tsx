import { useTranslation } from 'react-i18next'
import {
  BackOfficeStatusBadge,
  type StatusTone,
} from '@/features/common/components/back-office-status-badge'

type Status = 'pending' | 'active' | 'rejected' | 'terminated'
type FeeState = 'unpaid' | 'partly_paid' | 'paid'

const STATUS_TONE: Record<Status, StatusTone> = {
  pending: 'attention',
  active: 'positive',
  rejected: 'negative',
  terminated: 'neutral',
}

const FEE_TONE: Record<FeeState, StatusTone> = {
  unpaid: 'attention',
  partly_paid: 'attention',
  paid: 'positive',
}

export function MemberStatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation()
  return (
    <BackOfficeStatusBadge tone={STATUS_TONE[status]} data-testid={`member-status-${status}`}>
      {t(`members.status.${status}`)}
    </BackOfficeStatusBadge>
  )
}

export function MemberFeeBadge({ feeState, testId }: { feeState: FeeState; testId?: string }) {
  const { t } = useTranslation()
  return (
    <BackOfficeStatusBadge tone={FEE_TONE[feeState]} data-testid={testId}>
      {t(`members.feeState.${feeState}`)}
    </BackOfficeStatusBadge>
  )
}
