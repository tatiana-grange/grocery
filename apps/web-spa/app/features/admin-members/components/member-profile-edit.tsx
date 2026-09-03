import type { MemberDetail } from '@grocery/openapi-generator/client/types.gen'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@grocery/ui/components/primitives/dialog'
import { Input } from '@grocery/ui/components/primitives/input'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateMemberProfile } from '@/features/admin-members/utils/admin-members-queries'
import { handleMutationError } from '@/features/common/lib/api-error'

const FIELDS = ['addressLine1', 'addressLine2', 'postalCode', 'city', 'phone'] as const

export function MemberProfileEdit({ member }: { member: MemberDetail }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [name, setName] = useState(member.name)
  const [profile, setProfile] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((field) => [field, member.profile[field] ?? ''])),
  )

  const mutation = useMutation({
    mutationFn: () =>
      updateMemberProfile(member.id, {
        name: name.trim() || undefined,
        ...Object.fromEntries(Object.entries(profile).map(([k, v]) => [k, v || null])),
        version: member.version,
      }),
    onSuccess: () => {
      toast.success(t('adminMembers.toasts.updated'))
      void queryClient.invalidateQueries({ queryKey: ['admin-members'] })
    },
    onError: (error) =>
      handleMutationError(error, toast.error, {
        conflict: t('common.conflict'),
        fallback: t('adminMembers.toasts.error'),
      }),
  })

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" data-testid="member-edit-open" />}>
        {t('adminMembers.editDetails')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('adminMembers.editDetails')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            data-testid="member-edit-name"
            placeholder={t('members.account.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {FIELDS.map((field) => (
            <Input
              key={field}
              data-testid={`member-edit-${field}`}
              placeholder={t(`members.account.${field}`)}
              value={profile[field] ?? ''}
              onChange={(event) =>
                setProfile((current) => ({ ...current, [field]: event.target.value }))
              }
            />
          ))}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t('common.cancel')}</DialogClose>
          <DialogClose
            render={<Button data-testid="member-edit-save" />}
            disabled={name.trim().length < 2 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t('catalog.save')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
