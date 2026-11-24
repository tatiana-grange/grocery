import { zCalendarDay } from '@grocery/openapi-generator/client/zod.gen'
import { useListSearchParams } from '@/hooks/use-list-search-params'

export interface Period {
  from: string
  to: string
}

export function yearPeriod(year: number): Period {
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

/** The address query that carries a period from one accounting screen to the other. */
export function periodSearch(period: Period): string {
  return `?from=${period.from}&to=${period.to}`
}

interface UsePeriodResult {
  period: Period
  setPeriod: (next: Period) => void
}

/**
 * The period of an accounting screen lives in the address (`?from=&to=`), so a reload or a shared
 * link keeps it. Without a valid pair it is the current calendar year in the browser.
 */
export function usePeriod(): UsePeriodResult {
  const { searchParams, updateParams } = useListSearchParams()
  const from = zCalendarDay.safeParse(searchParams.get('from'))
  const to = zCalendarDay.safeParse(searchParams.get('to'))
  const period: Period =
    from.success && to.success && from.data <= to.data
      ? { from: from.data, to: to.data }
      : yearPeriod(new Date().getFullYear())

  const setPeriod = (next: Period): void =>
    updateParams({ from: next.from, to: next.to, page: undefined }, { replace: true })

  return { period, setPeriod }
}
