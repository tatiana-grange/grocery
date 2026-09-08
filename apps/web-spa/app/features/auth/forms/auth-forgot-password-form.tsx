import { Button } from '@grocery/ui/components/primitives/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@grocery/ui/components/primitives/form'
import { Input } from '@grocery/ui/components/primitives/input'
import { SegmentedControl } from '@grocery/ui/components/primitives/segmented-control'
import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { isLikelyPhone, type IdentifierMode } from '@/features/auth/lib/identifier'

function getSchema(mode: IdentifierMode) {
  return z.object({
    identifier: mode === 'email' ? z.string().email() : z.string().refine(isLikelyPhone),
  })
}

export interface AuthForgotPasswordFormData {
  identifier: string
}

interface Props {
  mode: IdentifierMode
  onModeChange: (mode: IdentifierMode) => void
  onSubmit: (data: AuthForgotPasswordFormData & { mode: IdentifierMode }) => void
  isPending: boolean
}

export const AuthForgotPasswordForm: React.FC<Props> = ({
  mode,
  onModeChange,
  onSubmit,
  isPending,
}) => {
  const { t } = useTranslation()
  const form = useForm<AuthForgotPasswordFormData>({
    resolver: zodResolver(getSchema(mode)),
  })

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((data) => onSubmit({ ...data, mode }))}
      >
        <SegmentedControl
          value={mode}
          onChange={onModeChange}
          itemClassName="flex-1"
          options={(['email', 'phone'] as const).map((option) => ({
            value: option,
            label: t(`auth.register.mode.${option}`),
            testId: `auth-forgot-mode-${option}`,
          }))}
        />

        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="identifier">
                {mode === 'email' ? t('auth.forgotPassword.email') : t('auth.register.phone')}
              </FormLabel>
              <FormControl>
                <Input
                  id="identifier"
                  data-testid="auth-forgot-identifier"
                  {...field}
                  type={mode === 'email' ? 'email' : 'tel'}
                  autoComplete={mode === 'email' ? 'email' : 'tel'}
                  placeholder={mode === 'email' ? 'your@email.com' : '+33 6 12 34 56 78'}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          data-testid="auth-forgot-submit"
          disabled={isPending}
        >
          {t('auth.forgotPassword.sendResetLink')}
        </Button>
      </form>
    </Form>
  )
}
