import { Input } from '@grocery/ui/components/primitives/input'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useMatch } from 'react-router'
import { distributionMemberSearchQueryOptions } from '@/features/distribution/utils/distribution-queries'
import { useDebouncedSearch } from '@/hooks/use-debounced-search'

/** The table's member search, rendered once by the distribution layout beside every page. */
export function DistributionMemberSearch(): ReactElement {
  const { t } = useTranslation()
  const [committed, setCommitted] = useState('')
  const { search, setSearch } = useDebouncedSearch('', (value) => setCommitted(value ?? ''))
  const currentMemberId = useMatch('/distribution/members/:memberId/*')?.params.memberId

  const { data, isLoading } = useQuery(distributionMemberSearchQueryOptions(committed))
  const rows = data?.data ?? []

  return (
    <div className="space-y-4">
      <label
        className="block font-serif text-xl font-semibold"
        htmlFor="distribution-member-search"
      >
        {t('distribution.search.label')}
      </label>
      <Input
        id="distribution-member-search"
        className="h-16 text-xl"
        data-testid="distribution-member-search"
        placeholder={t('distribution.search.placeholder')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div data-testid="distribution-search-results">
        {isLoading && committed ? <Skeleton className="h-19 w-full" /> : null}
        {committed && !isLoading && rows.length === 0 ? (
          <p className="text-base text-muted-foreground" data-testid="distribution-search-empty">
            {t('distribution.search.empty')}
          </p>
        ) : null}
        <ul className="space-y-2">
          {rows.map((member) => (
            <li key={member.id}>
              <Link
                to={`/distribution/members/${member.id}`}
                aria-current={member.id === currentMemberId ? 'page' : undefined}
                data-testid={`distribution-member-row-${member.id}`}
                className="group flex min-h-19 w-full items-center gap-3 rounded-xl border-2 border-border bg-card p-4 text-left hover:bg-accent aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold">{member.name}</p>
                  <p
                    className="text-sm text-muted-foreground group-aria-[current=page]:text-primary-foreground"
                    data-testid="member-number"
                  >
                    {member.membershipNumber}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {member.outstandingOrderCount > 0 ? (
                    <span className="rounded-full bg-straw px-3 text-sm font-semibold text-straw-foreground">
                      {t('distribution.search.outstanding', {
                        count: member.outstandingOrderCount,
                      })}
                    </span>
                  ) : (
                    <span className="text-sm">{t('distribution.search.nothingOutstanding')}</span>
                  )}
                  <span className="text-sm tabular-nums">
                    {t('distribution.eur', { value: member.balanceEur.toFixed(2) })}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
