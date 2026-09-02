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

function getRegisterSchema(mode: IdentifierMode, t: (key: string) => string) {
  return z
    .object({
      name: z.string().min(1),
      identifier:
        mode === 'email'
          ? z.string().email()
          : z.string().refine(isLikelyPhone, t('auth.register.invalidPhone')),
      password: z.string().min(8),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('errorCodes.PASSWORDS_DO_NOT_MATCH'),
      path: ['confirmPassword'],
    })
}

export interface AuthRegisterFormData {
  name: string
  identifier: string
  password: string
  confirmPassword: string
}

interface AuthRegisterFormProps {
  mode: IdentifierMode
  onModeChange: (mode: IdentifierMode) => void
  onSubmit: (data: AuthRegisterFormData & { mode: IdentifierMode }) => void
  isPending: boolean
}

export const AuthRegisterForm: React.FC<AuthRegisterFormProps> = ({
  mode,
  onModeChange,
  onSubmit,
  isPending,
}) => {
  const { t } = useTranslation()
  const form = useForm<AuthRegisterFormData>({
    resolver: zodResolver(getRegisterSchema(mode, t)),
  })

  return (
    <Form {...form}>
      <form
        className="mt-8 space-y-6"
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="name">{t('auth.register.name')}</FormLabel>
              <FormControl>
                <Input id="name" {...field} type="text" autoComplete="name" placeholder="John" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="identifier">
                {mode === 'email' ? t('auth.register.email') : t('auth.register.phone')}
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

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="password">{t('auth.register.password')}</FormLabel>
              <FormControl>
                <Input
                  id="password"
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="confirmPassword">{t('auth.register.confirmPassword')}</FormLabel>
              <FormControl>
                <Input
                  id="confirmPassword"
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button className="w-full" type="submit" disabled={isPending}>
          {t('auth.register.signUp')}
        </Button>
      </form>
    </Form>
  )
}
