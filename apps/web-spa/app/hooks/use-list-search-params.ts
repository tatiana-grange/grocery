import { useSearchParams } from 'react-router'

/**
 * Shared by every paginated list page (shop, admin products, admin members): reads the current
 * page from the URL and exposes one explicit way to change it alongside other filters —
 * `updateParams({ q: value, page: undefined })` resets pagination in the same call that changes
 * a filter, instead of a `page` reset being a side effect a caller can forget to wire in.
 */
export function useListSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const pageParam = Number(searchParams.get('page'))
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1

  const updateParams = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    setSearchParams(params)
  }

  return { searchParams, page, updateParams }
}
