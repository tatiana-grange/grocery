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
import { Link } from 'react-router'
import { z } from 'zod'
import { isLikelyPhone, type IdentifierMode } from '@/features/auth/lib/identifier'

function getLoginSchema(mode: IdentifierMode) {
  return z.object({
    identifier: mode === 'email' ? z.string().email() : z.string().refine(isLikelyPhone),
    password: z.string().min(1),
  })
}

export interface AuthLoginFormData {
  identifier: string
  password: string
}

interface AuthLoginFormProps {
  mode: IdentifierMode
  onModeChange: (mode: IdentifierMode) => void
  onSubmit: (data: AuthLoginFormData & { mode: IdentifierMode }) => void
  isPending: boolean
}

export const AuthLoginForm: React.FC<AuthLoginFormProps> = ({
  mode,
  onModeChange,
  onSubmit,
  isPending,
}) => {
  const { t } = useTranslation()
  const form = useForm<AuthLoginFormData>({
    resolver: zodResolver(getLoginSchema(mode)),
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
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="identifier">
                {mode === 'email' ? t('auth.login.email') : t('auth.register.phone')}
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
              <div className="flex justify-between">
                <FormLabel htmlFor="password">{t('auth.login.password')}</FormLabel>
                <Link className="text-sm text-muted-foreground" to="/forgot-password">
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <FormControl>
                <Input
                  id="password"
                  {...field}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  type="password"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button className="w-full" type="submit" disabled={isPending}>
          {t('auth.login.signIn')}
        </Button>
      </form>
    </Form>
  )
}
