import { useTranslation } from 'react-i18next'
import { authClient } from '@/lib/auth-client'

export default function DashboardHomePage() {
  const { t } = useTranslation()
  const { data: sessionData } = authClient.useSession()
  const name = sessionData?.user?.name ?? sessionData?.user?.email ?? t('common.user')

  return (
    <div className="space-y-8" data-testid="page-dashboard-home">
      <div className="border-b border-border pb-6">
        <p className="mb-1 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          {t('dashboard.home.eyebrow')}
        </p>
        <h1
          className="font-sans text-3xl font-black tracking-tight text-foreground"
          data-testid="dashboard-home-greeting"
        >
          {t('dashboard.home.title', { name })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.home.description')}</p>
      </div>
    </div>
  )
}
