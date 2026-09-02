import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@grocery/ui/components/primitives/table'
import { Tabs, TabsList, TabsTrigger } from '@grocery/ui/components/primitives/tabs'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import {
  MEMBERS_PAGE_SIZE,
  membersListQueryOptions,
} from '@/features/admin-members/utils/admin-members-queries'
import { MemberStatusBadge } from '@/features/admin-members/components/member-status-badge'

const STATUS_TABS = ['pending', 'active', 'all'] as const

export default function MembersListPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = (searchParams.get('status') ?? 'pending') as (typeof STATUS_TABS)[number]
  const page = Number(searchParams.get('page') ?? '1')
  const [search, setSearch] = useState(searchParams.get('q') ?? '')

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
      search: search || undefined,
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
        <Input
          className="w-64"
          placeholder={t('adminMembers.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') updateParams({ q: search || undefined, page: undefined })
          }}
        />
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
