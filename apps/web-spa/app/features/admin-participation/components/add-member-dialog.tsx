import type { AdminSlotDetail } from '@grocery/openapi-generator/client/types.gen'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@grocery/ui/components/primitives/dialog'
import { Input } from '@grocery/ui/components/primitives/input'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { membersListQueryOptions } from '@/features/admin-members/utils/admin-members-queries'
import {
  ADMIN_PARTICIPATION_QUERY_KEY,
  signUpMember,
} from '@/features/admin-participation/utils/admin-participation-queries'
import { PARTICIPATION_QUERY_KEY } from '@/features/participation/utils/participation-queries'
import { participationRefusalMessage } from '@/features/participation/utils/participation-refusal'
import { useDebouncedSearch } from '@/hooks/use-debounced-search'

interface AddMemberDialogProps {
  slot: AdminSlotDetail
  onClose: () => void
}

/** Finds an active member by name or number and signs them up on the slot. */
export function AddMemberDialog({ slot, onClose }: AddMemberDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [committed, setCommitted] = useState('')
  const { search, setSearch, flushSearch } = useDebouncedSearch(committed, (value) =>
    setCommitted(value ?? ''),
  )
  const signedUpIds = new Set(slot.signups.map((signup) => signup.memberId))

  const { data } = useQuery({
    ...membersListQueryOptions({ page: 1, search: committed || undefined, status: 'active' }),
    enabled: committed.length > 0,
  })

  const mutation = useMutation({
    mutationFn: (memberId: string) => signUpMember(slot.id, memberId),
    onSuccess: () => toast.success(t('adminParticipation.addMember.done')),
    onError: (error) => toast.error(participationRefusalMessage(error, t) ?? t('error.default')),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [ADMIN_PARTICIPATION_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: [PARTICIPATION_QUERY_KEY] })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-testid="add-member-dialog">
        <DialogHeader>
          <DialogTitle>{t('adminParticipation.addMember.title')}</DialogTitle>
          <DialogDescription>{t('adminParticipation.addMember.description')}</DialogDescription>
        </DialogHeader>
        <Input
          data-testid="add-member-search"
          placeholder={t('adminMembers.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') flushSearch()
          }}
        />
        <ul className="max-h-64 space-y-1 overflow-auto">
          {data?.data.map((member) => (
            <li key={member.id}>
              <Button
                variant="ghost"
                className="w-full justify-between"
                data-testid={`add-member-option-${member.id}`}
                disabled={signedUpIds.has(member.id) || mutation.isPending}
                onClick={() => mutation.mutate(member.id)}
              >
                <span>{member.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {member.membershipNumber}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
