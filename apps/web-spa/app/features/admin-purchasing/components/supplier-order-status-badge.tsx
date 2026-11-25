import type { SupplierOrder } from '@grocery/openapi-generator/client/types.gen'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BackOfficeStatusBadge,
  type StatusTone,
} from '@/features/common/components/back-office-status-badge'

type OrderStatus = SupplierOrder['status']

const ORDER_STATUS_TONE: Record<OrderStatus, StatusTone> = {
  draft: 'neutral',
  sent: 'attention',
  received: 'positive',
  closed: 'neutral',
}

interface SupplierOrderStatusBadgeProps {
  status: OrderStatus
  testId?: string
  className?: string
}

export function SupplierOrderStatusBadge({
  status,
  testId,
  className,
}: SupplierOrderStatusBadgeProps): ReactElement {
  const { t } = useTranslation()
  return (
    <BackOfficeStatusBadge
      tone={ORDER_STATUS_TONE[status]}
      className={className}
      data-testid={testId}
    >
      {t(`purchasing.status.${status}`)}
    </BackOfficeStatusBadge>
  )
}
