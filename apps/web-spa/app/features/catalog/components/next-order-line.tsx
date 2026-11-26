import type { CatalogSupplier } from '@grocery/openapi-generator/client/types.gen'
import { useTranslation } from 'react-i18next'
import { formatDistributionDay, formatSendingMoment } from '@/features/catalog/utils/supplier-form'

/** "Distribution ven. 4 déc. · envoi mer. 2 déc. à 8 h", every moment read in Paris time. */
export function NextOrderLine({
  nextOrder,
}: {
  nextOrder: NonNullable<CatalogSupplier['nextOrder']>
}) {
  const { t, i18n } = useTranslation()
  const sending = formatSendingMoment(nextOrder.sendingAt, i18n.language)
  return (
    <>
      {t('catalog.suppliers.schedule.nextOrder', {
        distribution: formatDistributionDay(nextOrder.distributionDay, i18n.language),
        sending: sending.day,
        hour: sending.hour,
      })}
    </>
  )
}
