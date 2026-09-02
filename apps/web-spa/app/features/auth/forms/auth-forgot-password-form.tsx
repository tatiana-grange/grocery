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
        <div className="flex gap-2">
          {(['email', 'phone'] as const).map((option) => (
            <Button
              key={option}
              type="button"
              variant={mode === option ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => onModeChange(option)}
            >
              {t(`auth.register.mode.${option}`)}
            </Button>
          ))}
        </div>

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

        <Button type="submit" className="w-full" disabled={isPending}>
          {t('auth.forgotPassword.sendResetLink')}
        </Button>
      </form>
    </Form>
  )
}
