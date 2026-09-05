import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { normalizePhone, type IdentifierMode } from '@/features/auth/lib/identifier'
import { authClient } from '@/lib/auth-client'
import { AuthPageHeader } from '../components/auth-page-header'
import { AuthLoginForm, type AuthLoginFormData } from '../forms/auth-login-form'

/** Only a same-page relative path — rejects `//evil.example` and absolute URLs in `?redirect=`. */
function isSafeRedirectPath(path: string | null): path is string {
  return !!path && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')
}

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectParam = searchParams.get('redirect')
  const redirectTo = isSafeRedirectPath(redirectParam) ? redirectParam : null
  const [mode, setMode] = useState<IdentifierMode>('email')

  const {
    mutate: loginMutate,
    isPending,
    error,
  } = useMutation({
    mutationFn: async (data: AuthLoginFormData & { mode: IdentifierMode }) => {
      const response =
        data.mode === 'phone'
          ? await authClient.signIn.phoneNumber({
              phoneNumber: normalizePhone(data.identifier),
              password: data.password,
              rememberMe: true,
            })
          : await authClient.signIn.email({
              email: data.identifier,
              password: data.password,
              callbackURL: '/',
              rememberMe: true,
            })

      if (response.error) throw new Error(response.error.code)
      toast.success(t('auth.login.loggedInSuccess'))
      return response.data
    },
    onSuccess: (data) => {
      navigate(('url' in (data ?? {}) && (data as { url?: string }).url) || redirectTo || '/')
    },
  })

  return (
    <div className="space-y-6" data-testid="page-login">
      <AuthPageHeader title={t('auth.login.title')} description={t('auth.login.description')} />
      <AuthLoginForm
        mode={mode}
        onModeChange={setMode}
        onSubmit={(data) => loginMutate(data)}
        isPending={isPending}
      />
      <div className="h-10">
        {error ? (
          <div
            className="text-sm font-medium text-red-500"
            data-testid={
              error.message === 'BANNED_USER' ? 'auth-login-error-banned' : 'auth-login-error'
            }
          >
            {error.message === 'BANNED_USER'
              ? t('auth.login.bannedUser')
              : t('auth.login.badCredentials')}
          </div>
        ) : null}
      </div>
      <div className="text-center text-sm">
        <Link to="/register" className="font-medium transition-colors">
          {t('auth.login.noAccount')} {t('auth.login.signUp')}
        </Link>
      </div>
    </div>
  )
}
