import { Badge } from '@grocery/ui/components/primitives/badge'
import { useTranslation } from 'react-i18next'

type Status = 'pending' | 'active' | 'rejected' | 'terminated'

const VARIANT: Record<Status, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  active: 'default',
  rejected: 'destructive',
  terminated: 'outline',
}

export function MemberStatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation()
  return <Badge variant={VARIANT[status]}>{t(`members.status.${status}`)}</Badge>
}
