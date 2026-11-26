import type { MemberListItem } from '@grocery/openapi-generator/client/types.gen'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BackOfficeStatusBadge,
  type StatusTone,
} from '@/features/common/components/back-office-status-badge'

type FeeState = MemberListItem['feeState']

const FEE_TONE: Record<FeeState, StatusTone> = {
  unpaid: 'attention',
  partly_paid: 'attention',
  paid: 'positive',
}

interface MemberFeeBadgeProps {
  feeState: FeeState
  testId?: string
}

export function MemberFeeBadge({ feeState, testId }: MemberFeeBadgeProps): ReactElement {
  const { t } = useTranslation()
  return (
    <BackOfficeStatusBadge tone={FEE_TONE[feeState]} data-testid={testId}>
      {t(`members.feeState.${feeState}`)}
    </BackOfficeStatusBadge>
  )
}
