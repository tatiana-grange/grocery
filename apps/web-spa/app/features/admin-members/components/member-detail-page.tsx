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
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { Textarea } from '@grocery/ui/components/primitives/textarea'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { MemberFeePanel } from '@/features/admin-members/components/member-fee-panel'
import { MemberProfileEdit } from '@/features/admin-members/components/member-profile-edit'
import { MemberStatusBadge } from '@/features/admin-members/components/member-status-badge'
import {
  decideMember,
  memberDetailQueryOptions,
  reactivateMember,
  setMemberRoles,
  terminateMember,
} from '@/features/admin-members/utils/admin-members-queries'

export default function MemberDetailPage() {
  const { t } = useTranslation()
  const { memberId = '' } = useParams()
  const queryClient = useQueryClient()
  const [rejectReason, setRejectReason] = useState('')

  const { data: member, isLoading } = useQuery(memberDetailQueryOptions(memberId))

  const mutation = useMutation({
    mutationFn: (
      body:
        | { decision: 'validate'; version: number }
        | { decision: 'reject'; reason: string; version: number },
    ) => decideMember(memberId, body),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.decision === 'validate'
          ? t('adminMembers.toasts.validated')
          : t('adminMembers.toasts.rejected'),
      )
      void queryClient.invalidateQueries({ queryKey: ['admin-members'] })
    },
    onError: () => toast.error(t('adminMembers.toasts.error')),
  })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin-members'] })
  const onError = () => toast.error(t('adminMembers.toasts.error'))

  const roleMutation = useMutation({
    mutationFn: (roles: ('member' | 'admin')[]) =>
      setMemberRoles(memberId, { roles, version: member!.version }),
    onSuccess: () => {
      toast.success(t('adminMembers.roleUpdated'))
      invalidate()
    },
    onError,
  })

  const lifecycleMutation = useMutation({
    mutationFn: (action: { type: 'terminate'; reason: string } | { type: 'reactivate' }) =>
      action.type === 'terminate'
        ? terminateMember(memberId, { reason: action.reason, version: member!.version })
        : reactivateMember(memberId, { version: member!.version }),
    onSuccess: () => {
      toast.success(t('adminMembers.toasts.updated'))
      invalidate()
    },
    onError,
  })

  const [terminateReason, setTerminateReason] = useState('')

  if (isLoading || !member) {
    return <Skeleton className="h-64 w-full" />
  }

  const isPending = member.status === 'pending'
  const isAdmin = member.roles.includes('admin')

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" render={<Link to="/admin/members" />}>
        <ArrowLeft className="mr-2 size-4" />
        {t('adminMembers.backToList')}
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{member.name}</h1>
          <p className="font-mono text-xs text-muted-foreground">{member.membershipNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <MemberProfileEdit member={member} />
          <MemberStatusBadge status={member.status} />
        </div>
      </div>

      <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        <Field label={t('adminMembers.columns.identifier')} value={member.identifiers.email ?? member.identifiers.phoneNumber ?? '—'} />
        <Field
          label={t('members.account.identifierConfirmed')}
          value={
            member.identifiers.emailVerified || member.identifiers.phoneNumberVerified
              ? t('common.active')
              : '—'
          }
        />
        <Field label={t('adminMembers.columns.fee')} value={t(`members.feeState.${member.fee.state}`)} />
        <Field label={t('adminMembers.roles')} value={member.roles.join(', ')} />
      </dl>

      {isPending && (
        <div className="flex gap-3 rounded-lg border border-border p-4">
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ decision: 'validate', version: member.version })}
          >
            {t('adminMembers.validate')}
          </Button>

          <Dialog>
            <DialogTrigger render={<Button variant="destructive" disabled={mutation.isPending} />}>
              {t('adminMembers.reject')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('adminMembers.rejectDialog.title')}</DialogTitle>
              </DialogHeader>
              <Textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder={t('adminMembers.rejectDialog.reasonPlaceholder')}
              />
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  {t('common.cancel')}
                </DialogClose>
                <DialogClose
                  render={<Button variant="destructive" />}
                  disabled={!rejectReason.trim()}
                  onClick={() =>
                    mutation.mutate({
                      decision: 'reject',
                      reason: rejectReason.trim(),
                      version: member.version,
                    })
                  }
                >
                  {t('adminMembers.reject')}
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {member.status === 'active' && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
          <Button
            variant="outline"
            size="sm"
            disabled={roleMutation.isPending}
            onClick={() => roleMutation.mutate(isAdmin ? ['member'] : ['member', 'admin'])}
          >
            {isAdmin ? t('adminMembers.removeAdmin') : t('adminMembers.makeAdmin')}
          </Button>

          <Dialog>
            <DialogTrigger render={<Button variant="destructive" size="sm" />}>
              {t('adminMembers.terminate')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('adminMembers.terminateDialog.title')}</DialogTitle>
              </DialogHeader>
              <Textarea
                value={terminateReason}
                onChange={(event) => setTerminateReason(event.target.value)}
                placeholder={t('adminMembers.terminateDialog.reasonPlaceholder')}
              />
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>{t('common.cancel')}</DialogClose>
                <DialogClose
                  render={<Button variant="destructive" />}
                  disabled={!terminateReason.trim()}
                  onClick={() =>
                    lifecycleMutation.mutate({ type: 'terminate', reason: terminateReason.trim() })
                  }
                >
                  {t('adminMembers.terminate')}
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {member.status === 'terminated' && (
        <div className="rounded-lg border border-border p-4">
          <Button
            size="sm"
            disabled={lifecycleMutation.isPending}
            onClick={() => lifecycleMutation.mutate({ type: 'reactivate' })}
          >
            {t('adminMembers.reactivate')}
          </Button>
        </div>
      )}

      {member.status === 'active' && <MemberFeePanel member={member} />}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t('adminMembers.history')}
        </h2>
        <ul className="space-y-1 text-sm">
          {member.statusHistory.map((entry, index) => (
            <li key={index} className="flex justify-between border-b border-border py-1">
              <span>
                {entry.fromStatus ? `${entry.fromStatus} → ` : ''}
                <strong>{entry.toStatus}</strong>
                {entry.reason ? ` — ${entry.reason}` : ''}
              </span>
              <span className="text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString()}
                {entry.changedByName ? ` · ${entry.changedByName}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-4">
      <dt className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}
