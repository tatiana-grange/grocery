import { Badge } from '@grocery/ui/components/primitives/badge'
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
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { toast } from '@grocery/ui/components/primitives/sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@grocery/ui/components/primitives/table'
import { Tabs, TabsList, TabsTrigger } from '@grocery/ui/components/primitives/tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { handleMutationError } from '@/features/common/lib/api-error'
import {
  createMember,
  MEMBERS_PAGE_SIZE,
  membersListQueryOptions,
} from '@/features/admin-members/utils/admin-members-queries'
import { MemberStatusBadge } from '@/features/admin-members/components/member-status-badge'

const STATUS_TABS = ['pending', 'active', 'all'] as const

export default function MembersListPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = (searchParams.get('status') ?? 'pending') as (typeof STATUS_TABS)[number]
  const committedSearch = searchParams.get('q') ?? ''
  const pageParam = Number(searchParams.get('page'))
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1
  const [search, setSearch] = useState(committedSearch)

  const updateParams = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    setSearchParams(params)
  }

  const { data, isLoading } = useQuery(
    membersListQueryOptions({
      page,
      search: committedSearch || undefined,
      status: status === 'all' ? undefined : status,
    }),
  )

  const total = data?.meta.itemCount ?? 0
  const pageCount = Math.max(1, Math.ceil(total / MEMBERS_PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">{t('adminMembers.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('adminMembers.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={status}
          onValueChange={(value) => updateParams({ status: value, page: undefined })}
        >
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {t(`adminMembers.tabs.${tab}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Input
            className="w-56"
            placeholder={t('adminMembers.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') updateParams({ q: search || undefined, page: undefined })
            }}
          />
          <CreateMemberDialog />
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('adminMembers.columns.number')}</TableHead>
              <TableHead>{t('adminMembers.columns.name')}</TableHead>
              <TableHead>{t('adminMembers.columns.identifier')}</TableHead>
              <TableHead>{t('adminMembers.columns.status')}</TableHead>
              <TableHead>{t('adminMembers.columns.fee')}</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {t('adminMembers.empty')}
                </TableCell>
              </TableRow>
            )}

            {data?.data.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-mono text-xs">{member.membershipNumber}</TableCell>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {member.email ?? member.phoneNumber ?? '—'}
                </TableCell>
                <TableCell>
                  <MemberStatusBadge status={member.status} />
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{t(`members.feeState.${member.feeState}`)}</Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" render={<Link to={`/admin/members/${member.id}`} />}>
                    {t('adminMembers.review')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{t('adminMembers.count', { count: total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => updateParams({ page: String(page - 1) })}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span>
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= pageCount}
            onClick={() => updateParams({ page: String(page + 1) })}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function CreateMemberDialog() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      createMember({
        name: name.trim(),
        email: email.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t('adminMembers.create.done'))
      setName('')
      setEmail('')
      setPhoneNumber('')
      void queryClient.invalidateQueries({ queryKey: ['admin-members'] })
    },
    onError: (error) =>
      handleMutationError(error, toast.error, {
        conflict: t('adminMembers.create.duplicate'),
        fallback: t('adminMembers.toasts.error'),
      }),
  })

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <UserPlus className="mr-2 size-4" />
        {t('adminMembers.create.new')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('adminMembers.create.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder={t('adminMembers.columns.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            type="email"
            placeholder={t('auth.register.email')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            type="tel"
            placeholder={t('auth.register.phone')}
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('adminMembers.create.hint')}</p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t('common.cancel')}</DialogClose>
          <DialogClose
            render={<Button />}
            disabled={name.trim().length < 2 || !(email.trim() || phoneNumber.trim())}
            onClick={() => mutation.mutate()}
          >
            {t('adminMembers.create.new')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
