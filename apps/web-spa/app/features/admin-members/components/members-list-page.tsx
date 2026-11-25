import { ListPagination } from '@grocery/ui/components/app'
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
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { handleMutationError } from '@/features/common/lib/api-error'
import {
  createMember,
  MEMBERS_PAGE_SIZE,
  membersListQueryOptions,
} from '@/features/admin-members/utils/admin-members-queries'
import {
  MemberFeeBadge,
  MemberStatusBadge,
} from '@/features/admin-members/components/member-status-badge'
import { BackOfficePageHead } from '@/features/common/components/back-office-page-head'
import { BackOfficeTableFrame } from '@/features/common/components/back-office-table-frame'
import { useBackOfficePaginationLabels } from '@/features/common/hooks/use-back-office-pagination-labels'
import { useDebouncedSearch } from '@/hooks/use-debounced-search'
import { useListSearchParams } from '@/hooks/use-list-search-params'

const STATUS_TABS = ['pending', 'active', 'all'] as const

export default function MembersListPage() {
  const { t } = useTranslation()
  const { searchParams, page, updateParams } = useListSearchParams()
  const status = (searchParams.get('status') ?? 'pending') as (typeof STATUS_TABS)[number]
  const committedSearch = searchParams.get('q') ?? ''
  const { search, setSearch, flushSearch } = useDebouncedSearch(committedSearch, (value) =>
    updateParams({ q: value, page: undefined }, { replace: true }),
  )

  const { data, isLoading } = useQuery(
    membersListQueryOptions({
      page,
      search: committedSearch || undefined,
      status: status === 'all' ? undefined : status,
    }),
  )

  const total = data?.meta.itemCount ?? 0
  const pageCount = Math.max(1, Math.ceil(total / MEMBERS_PAGE_SIZE))
  const paginationLabels = useBackOfficePaginationLabels(page, pageCount)

  return (
    <div className="space-y-6" data-testid="page-members-list">
      <BackOfficePageHead
        title={t('adminMembers.title')}
        description={t('adminMembers.subtitle')}
        actions={<CreateMemberDialog />}
      />

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="h-13 w-80"
          data-testid="members-search"
          placeholder={t('adminMembers.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') flushSearch()
          }}
        />
        <Tabs
          value={status}
          onValueChange={(value) => updateParams({ status: value, page: undefined })}
        >
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} data-testid={`members-tab-${tab}`}>
                {t(`adminMembers.tabs.${tab}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <BackOfficeTableFrame>
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
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                  data-testid="members-empty"
                >
                  {t('adminMembers.empty')}
                </TableCell>
              </TableRow>
            )}

            {data?.data.map((member) => (
              <TableRow
                key={member.id}
                className={member.status === 'pending' ? 'bg-straw-tint' : undefined}
                data-testid={`members-row-${member.membershipNumber}`}
              >
                <TableCell className="font-mono text-sm">{member.membershipNumber}</TableCell>
                <TableCell className="font-medium" data-testid="members-row-name">
                  {member.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.email ?? member.phoneNumber ?? '—'}
                </TableCell>
                <TableCell>
                  <MemberStatusBadge status={member.status} />
                </TableCell>
                <TableCell>
                  <MemberFeeBadge feeState={member.feeState} />
                </TableCell>
                <TableCell>
                  <Button
                    variant={member.status === 'pending' ? 'default' : 'outline'}
                    size="sm"
                    data-testid="members-row-review"
                    render={<Link to={`/admin/members/${member.id}`} />}
                  >
                    {member.status === 'pending' ? t('adminMembers.review') : t('backOffice.open')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </BackOfficeTableFrame>

      <ListPagination
        page={page}
        pageCount={pageCount}
        onPageChange={(next) => updateParams({ page: String(next) })}
        testIdPrefix="members"
        count={t('adminMembers.count', { count: total })}
        {...paginationLabels}
      />
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
      <DialogTrigger render={<Button size="sm" data-testid="members-create-open" />}>
        <UserPlus />
        {t('adminMembers.create.new')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('adminMembers.create.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            data-testid="members-create-name"
            placeholder={t('adminMembers.columns.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            type="email"
            data-testid="members-create-email"
            placeholder={t('auth.register.email')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            type="tel"
            data-testid="members-create-phone"
            placeholder={t('auth.register.phone')}
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
          />
          <p className="text-base text-muted-foreground">{t('adminMembers.create.hint')}</p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t('common.cancel')}</DialogClose>
          <DialogClose
            render={<Button data-testid="members-create-submit" />}
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
