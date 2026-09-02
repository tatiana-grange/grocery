import { useTranslation } from 'react-i18next'

/**
 * Back-office catalogue. Filled in with suppliers, categories, products (per-unit and
 * by-weight), price history, and archiving in User Story 2.
 */
export default function CatalogPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-black tracking-tight">{t('catalog.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('catalog.comingSoon')}</p>
    </div>
  )
}
