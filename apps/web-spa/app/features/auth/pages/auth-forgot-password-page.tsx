import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import {
  normalizePhone,
  type IdentifierMode,
} from '@/features/auth/lib/identifier'
import { authClient } from '@/lib/auth-client'
import { AuthPageHeader } from '../components/auth-page-header'
import {
  AuthForgotPasswordForm,
  type AuthForgotPasswordFormData,
} from '../forms/auth-forgot-password-form'

type Step = 'form' | 'emailSent' | 'phoneReset'

export default function AuthForgotPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<IdentifierMode>('email')
  const [step, setStep] = useState<Step>('form')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [lastIdentifier, setLastIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const request = useMutation({
    mutationFn: async (data: AuthForgotPasswordFormData & { mode: IdentifierMode }) => {
      setLastIdentifier(data.identifier)
      if (data.mode === 'phone') {
        const phone = normalizePhone(data.identifier)
        const response = await authClient.phoneNumber.requestPasswordReset({ phoneNumber: phone })
        if (response.error) throw new Error(response.error.code)
        return { mode: 'phone' as const, phone }
      }
      const response = await authClient.requestPasswordReset({
        email: data.identifier,
        redirectTo: '/reset-password',
      })
      if (response.error) throw new Error(response.error.code)
      return { mode: 'email' as const }
    },
    onSuccess: (result) => {
      if (result.mode === 'phone') {
        setPhoneNumber(result.phone)
        setStep('phoneReset')
      } else {
        setStep('emailSent')
      }
    },
  })

  const reset = useMutation({
    mutationFn: async () => {
      const response = await authClient.phoneNumber.resetPassword({
        phoneNumber,
        otp,
        newPassword,
      })
      if (response.error) throw new Error(response.error.code)
      return response.data
    },
    onSuccess: () => {
      toast.success(t('auth.resetPassword.reset'))
      navigate('/login')
    },
    onError: () => toast.error(t('auth.register.invalidCode')),
  })

  return (
    <div className="space-y-6" data-testid="page-forgot-password">
      <AuthPageHeader
        title={t('auth.forgotPassword.title')}
        description={t('auth.forgotPassword.description')}
      />

      {step === 'form' && (
        <>
          <AuthForgotPasswordForm
            mode={mode}
            onModeChange={setMode}
            onSubmit={(data) => request.mutate(data)}
            isPending={request.isPending}
          />
          {request.error ? (
            <p className="text-sm font-medium text-red-500">
              {t('auth.forgotPassword.failedToSend')}
            </p>
          ) : null}
        </>
      )}

      {step === 'emailSent' && (
        <div className="space-y-3 text-center" data-testid="auth-forgot-sent">
          <p className="text-sm text-muted-foreground">
            {t('auth.forgotPassword.emailSent')}
          </p>
          <Button
            variant="ghost"
            className="w-full"
            disabled={request.isPending}
            onClick={() =>
              request.mutate({ mode: 'email', identifier: lastIdentifier })
            }
          >
            {t('auth.register.resendEmail')}
          </Button>
        </div>
      )}

      {step === 'phoneReset' && (
        <div className="space-y-3">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t('auth.register.otp.confirm')}
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder={t('auth.resetPassword.password')}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <Button
            className="w-full"
            disabled={otp.trim().length < 4 || newPassword.length < 8 || reset.isPending}
            onClick={() => reset.mutate()}
          >
            {t('auth.resetPassword.reset')}
          </Button>
        </div>
      )}

      <div className="text-center text-sm">
        <Link to="/login" className="font-medium transition-colors">
          {t('auth.forgotPassword.backToLogin')}
        </Link>
      </div>
    </div>
  )
}
