import { PageTitle } from '@grocery/ui/components/app'
import { Badge } from '@grocery/ui/components/primitives/badge'
import { Input } from '@grocery/ui/components/primitives/input'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { distributionMemberSearchQueryOptions } from '@/features/distribution/utils/distribution-queries'
import { useDebouncedSearch } from '@/hooks/use-debounced-search'

/**
 * The table's landing screen. Member search first, because that is how a distribution
 * actually starts: someone walks up. The waiting lists (US5) sit below it.
 */
export default function DistributionHomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [committed, setCommitted] = useState('')
  const { search, setSearch } = useDebouncedSearch('', (value) => setCommitted(value ?? ''))

  const { data, isLoading } = useQuery(distributionMemberSearchQueryOptions(committed))
  const rows = data?.data ?? []

  return (
    <div className="space-y-6" data-testid="page-distribution-home">
      <div>
        <PageTitle>{t('distribution.title')}</PageTitle>
        <p className="text-sm text-muted-foreground">{t('distribution.subtitle')}</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="distribution-member-search">
          {t('distribution.search.label')}
        </label>
        <Input
          id="distribution-member-search"
          className="max-w-md text-base"
          data-testid="distribution-member-search"
          placeholder={t('distribution.search.placeholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div data-testid="distribution-search-results" className="space-y-2">
        {isLoading && committed ? <Skeleton className="h-16 w-full" /> : null}
        {committed && !isLoading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="distribution-search-empty">
            {t('distribution.search.empty')}
          </p>
        ) : null}
        {rows.map((member) => (
          <button
            key={member.id}
            type="button"
            data-testid={`distribution-member-row-${member.id}`}
            onClick={() => navigate(`/distribution/members/${member.id}`)}
            className="flex w-full items-center gap-4 rounded-lg border border-border p-4 text-left hover:bg-accent"
          >
            <div className="flex-1">
              <p className="font-medium">{member.name}</p>
              <p className="text-sm text-muted-foreground" data-testid="member-number">
                {member.membershipNumber}
              </p>
            </div>
            <Badge variant={member.outstandingOrderCount > 0 ? 'default' : 'secondary'}>
              {member.outstandingOrderCount > 0
                ? t('distribution.search.outstanding', { count: member.outstandingOrderCount })
                : t('distribution.search.nothingOutstanding')}
            </Badge>
            <span className="tabular-nums font-medium">
              {t('distribution.eur', { value: member.balanceEur.toFixed(2) })}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
