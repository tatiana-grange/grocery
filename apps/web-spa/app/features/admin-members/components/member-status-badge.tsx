import type { MemberListItem } from '@grocery/openapi-generator/client/types.gen'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BackOfficeStatusBadge,
  type StatusTone,
} from '@/features/common/components/back-office-status-badge'

type MemberStatus = MemberListItem['status']

const STATUS_TONE: Record<MemberStatus, StatusTone> = {
  pending: 'attention',
  active: 'positive',
  rejected: 'negative',
  terminated: 'neutral',
}

interface MemberStatusBadgeProps {
  status: MemberStatus
}

export function MemberStatusBadge({ status }: MemberStatusBadgeProps): ReactElement {
  const { t } = useTranslation()
  return (
    <BackOfficeStatusBadge tone={STATUS_TONE[status]} data-testid={`member-status-${status}`}>
      {t(`members.status.${status}`)}
    </BackOfficeStatusBadge>
  )
}
