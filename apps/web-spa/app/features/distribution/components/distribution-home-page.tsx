import { useTranslation } from 'react-i18next'

/**
 * The distribution table's landing screen: member search, and the waiting lists.
 * Filled in by US1 (search) and US5 (lists).
 */
export default function DistributionHomePage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6" data-testid="page-distribution-home">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('distribution.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('distribution.subtitle')}</p>
      </div>
    </div>
  )
}
