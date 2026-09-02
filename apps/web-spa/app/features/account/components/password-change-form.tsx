import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { authClient } from '@/lib/auth-client'

export function PasswordChangeForm() {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })
      if (response.error) throw new Error(response.error.message ?? 'error')
      return response.data
    },
    onSuccess: () => {
      toast.success(t('members.account.passwordChanged'))
      setCurrentPassword('')
      setNewPassword('')
    },
    onError: () => toast.error(t('members.account.passwordError')),
  })

  return (
    <section className="max-w-sm space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {t('members.account.changePassword')}
      </h2>
      <Input
        type="password"
        autoComplete="current-password"
        placeholder={t('members.account.currentPassword')}
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
      />
      <Input
        type="password"
        autoComplete="new-password"
        placeholder={t('members.account.newPassword')}
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
      />
      <Button
        variant="outline"
        disabled={!currentPassword || newPassword.length < 8 || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {t('members.account.changePassword')}
      </Button>
    </section>
  )
}
