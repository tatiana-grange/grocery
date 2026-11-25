import { Button } from '@grocery/ui/components/primitives/button'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { DistributionNotice } from '@/features/distribution/components/distribution-notice'

interface HandoverRecordedNoticeProps {
  handoverId: string
}

/** Says a handover or an express sale was recorded, with the link to its receipt. */
export function HandoverRecordedNotice({ handoverId }: HandoverRecordedNoticeProps): ReactElement {
  const { t } = useTranslation()

  return (
    <DistributionNotice tone="success" data-testid="handover-receipt">
      <div className="flex flex-wrap items-center gap-2">
        <span>{t('distribution.handover.receipt')}</span>
        <Button
          variant="link"
          className="ml-auto"
          data-testid="handover-receipt-link"
          render={<Link to={`/distribution/handovers/${handoverId}`} />}
        >
          {t('distribution.waiting.open')}
        </Button>
      </div>
    </DistributionNotice>
  )
}
