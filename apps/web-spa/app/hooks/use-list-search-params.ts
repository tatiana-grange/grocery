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

  /**
   * `replace` swaps the current history entry instead of pushing a new one — what a debounced
   * search box wants, so typing a word does not turn the back button into a dozen steps.
   */
  const updateParams = (
    next: Record<string, string | undefined>,
    options: { replace?: boolean } = {},
  ) => {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    setSearchParams(params, { replace: options.replace ?? false })
  }

  return { searchParams, page, updateParams }
}
