import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  normalizePhone,
  synthesizedEmailFor,
  type IdentifierMode,
} from '@/features/auth/lib/identifier'
import { authClient } from '@/lib/auth-client'
import { AuthPageHeader } from '../components/auth-page-header'
import { AuthRegisterForm, type AuthRegisterFormData } from '../forms/auth-register-form'

type Step = 'form' | 'otp' | 'done'

export default function Register() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<IdentifierMode>('email')
  const [step, setStep] = useState<Step>('form')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')

  const register = useMutation({
    mutationFn: async (data: AuthRegisterFormData & { mode: IdentifierMode }) => {
      if (data.mode === 'phone') {
        const phone = normalizePhone(data.identifier)
        const signUp = await authClient.signUp.email({
          name: data.name,
          email: synthesizedEmailFor(phone),
          password: data.password,
          phoneNumber: phone,
        })
        if (signUp.error) throw new Error(signUp.error.code)

        const otp = await authClient.phoneNumber.sendOtp({ phoneNumber: phone })
        if (otp.error) throw new Error(otp.error.code)
        return { mode: 'phone' as const, phone }
      }

      const signUp = await authClient.signUp.email({
        name: data.name,
        email: data.identifier,
        password: data.password,
        callbackURL: '/',
      })
      if (signUp.error) throw new Error(signUp.error.code)
      return { mode: 'email' as const }
    },
    onSuccess: (result) => {
      toast.success(t('auth.register.registrationSuccessful'))
      if (result.mode === 'phone') {
        setPhoneNumber(result.phone)
        setStep('otp')
      } else {
        setStep('done')
      }
    },
  })

  const verify = useMutation({
    mutationFn: async () => {
      const response = await authClient.phoneNumber.verify({
        phoneNumber,
        code,
        disableSession: true,
      })
      if (response.error) throw new Error(response.error.code)
      return response.data
    },
    onSuccess: () => setStep('done'),
    onError: () => toast.error(t('auth.register.invalidCode')),
  })

  if (step === 'done') {
    return (
      <div>
        <AuthPageHeader
          title={t('auth.register.success.title')}
          description={
            mode === 'phone'
              ? t('auth.register.success.phoneDescription')
              : t('auth.register.success.description')
          }
        />
        <div className="mt-4 text-center text-sm">
          <Link to="/login" className="font-medium">
            {t('auth.register.backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  if (step === 'otp') {
    return (
      <div className="space-y-6">
        <AuthPageHeader
          title={t('auth.register.otp.title')}
          description={t('auth.register.otp.description', { phone: phoneNumber })}
        />
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <Button
          className="w-full"
          disabled={code.trim().length < 4 || verify.isPending}
          onClick={() => verify.mutate()}
        >
          {t('auth.register.otp.confirm')}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => authClient.phoneNumber.sendOtp({ phoneNumber })}
        >
          {t('auth.register.otp.resend')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AuthPageHeader
        title={t('auth.register.title')}
        description={t('auth.register.description')}
      />
      <AuthRegisterForm
        mode={mode}
        onModeChange={setMode}
        onSubmit={(data) => register.mutate(data)}
        isPending={register.isPending}
      />
      <div className="h-6">
        {register.error ? (
          <div className="text-sm font-medium text-red-500">
            {t('auth.register.failedToRegister')}
          </div>
        ) : null}
      </div>
      <div className="text-center text-sm">
        <Link to="/login" className="font-medium">
          {t('auth.register.hasAccount')} {t('auth.register.login')}
        </Link>
      </div>
    </div>
  )
}
