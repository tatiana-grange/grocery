import { AnvilIcon, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router'

const ASIDE_POINTS = ['shop', 'pay', 'history'] as const

export default function AuthLayout() {
  const { t } = useTranslation()

  return (
    <div className="grid min-h-svh lg:grid-cols-2 md:p-4">
      <div className="flex flex-col gap-4 ">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link to="/" className="flex items-center gap-2 font-medium">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <AnvilIcon className="size-4" />
            </div>
            Grocery
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </div>
      </div>
      <div className="relative hidden rounded-xl bg-primary/5 p-10 backdrop-blur-sm lg:flex lg:items-center lg:justify-center">
        <div className="max-w-md">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {t('auth.aside.title')}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">{t('auth.aside.body')}</p>
          <ul className="mt-8 space-y-3">
            {ASIDE_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
                <span className="text-sm text-foreground">{t(`auth.aside.points.${point}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
