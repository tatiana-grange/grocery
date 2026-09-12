import { useTranslation } from 'react-i18next'

/**
 * One member's table screen: their outstanding orders, balance, and the handover form.
 * Filled in by US1 (the read-only view) and US2 (the handover).
 */
export default function DistributionMemberPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6" data-testid="page-distribution-member">
      <h1 className="text-2xl font-semibold tracking-tight">{t('distribution.title')}</h1>
    </div>
  )
}
