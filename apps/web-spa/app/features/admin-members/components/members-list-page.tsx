import { useTranslation } from 'react-i18next'

/**
 * Back-office member management. Filled in with the pending queue, the member list, and the
 * validate / reject / role / termination actions in User Stories 1, 4, and 5.
 */
export default function MembersListPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-black tracking-tight">{t('adminMembers.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('adminMembers.comingSoon')}</p>
    </div>
  )
}
