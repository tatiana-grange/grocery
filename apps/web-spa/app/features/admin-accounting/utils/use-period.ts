import { useSearchParams } from 'react-router'

export interface Period {
  from: string
  to: string
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** 1 January to 31 December of the given year, as two calendar days. */
export function yearPeriod(year: number): Period {
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

/**
 * The period of an accounting screen lives in the address (`?from=&to=`), so a reload or a shared
 * link keeps it. Without a valid pair it is the current calendar year in the browser.
 */
export function usePeriod() {
  const [searchParams, setSearchParams] = useSearchParams()
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const isValid = from !== null && to !== null && DAY.test(from) && DAY.test(to) && from <= to
  const period: Period = isValid ? { from, to } : yearPeriod(new Date().getFullYear())

  const setPeriod = (next: Period) => {
    const params = new URLSearchParams(searchParams)
    params.set('from', next.from)
    params.set('to', next.to)
    params.delete('page')
    setSearchParams(params, { replace: true })
  }

  return { period, setPeriod }
}
