import { useTranslation } from 'react-i18next'

/**
 * Member self-service account page. Filled in with profile editing, membership status,
 * fee state, and the personal QR code in User Story 3.
 */
export default function AccountPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-black tracking-tight">{t('members.account.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('members.account.comingSoon')}</p>
    </div>
  )
}
