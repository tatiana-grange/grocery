import { AwningBand } from '@grocery/ui/components/app/awning-band'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router'

const ASIDE_POINTS = ['shop', 'pay', 'history'] as const

export default function AuthLayout() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AwningBand />
      <div className="grid flex-1 md:p-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 px-4 py-6">
          <div className="flex justify-center gap-2 md:justify-start">
            <Link
              to="/"
              data-testid="auth-brand"
              className="font-serif text-2xl font-bold text-foreground"
            >
              {t('members.title')}
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-sm">
              <Outlet />
            </div>
          </div>
        </div>
        <div
          data-testid="auth-aside"
          className="relative hidden rounded-xl border-2 border-border bg-card p-10 lg:flex lg:items-center lg:justify-center"
        >
          <div className="max-w-md">
            <h2 className="font-serif text-3xl font-bold tracking-tight text-foreground">
              {t('auth.aside.title')}
            </h2>
            <p className="mt-3 text-base text-muted-foreground">{t('auth.aside.body')}</p>
            <ul className="mt-8 space-y-3">
              {ASIDE_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-4" />
                  </span>
                  <span className="text-base text-foreground">
                    {t(`auth.aside.points.${point}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
