import { useEffect, useRef, useState } from 'react'

/** How long typing has to pause before the search is sent. */
const SEARCH_DEBOUNCE_MS = 300

interface DebouncedSearch {
  /** What the input shows — updated on every keystroke. */
  search: string
  setSearch: (value: string) => void
  /** Sends the current text right away, for the user who hits Enter rather than waiting. */
  flushSearch: () => void
}

/**
 * Splits a search box in two: the input reacts to every keystroke, while the committed term —
 * the one in the URL, and therefore the one that is fetched — only follows once typing pauses.
 *
 * `commit` is called with `undefined` for an empty box, so the caller can drop `?q=` rather than
 * leave an empty one behind. Committing replaces the current history entry instead of pushing
 * one, otherwise typing a word would bury the previous page under a dozen back steps.
 */
export function useDebouncedSearch(
  committedSearch: string,
  commit: (value: string | undefined) => void,
  delayMs: number = SEARCH_DEBOUNCE_MS,
): DebouncedSearch {
  const [search, setSearch] = useState(committedSearch)
  const commitRef = useRef(commit)
  commitRef.current = commit
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // The committed term can change without us: going back, or another control clearing filters.
  // Follow it, instead of re-committing the now-stale text the input still holds.
  useEffect(() => {
    setSearch(committedSearch)
  }, [committedSearch])

  useEffect(() => {
    if (search === committedSearch) return
    timeoutRef.current = setTimeout(() => commitRef.current(search || undefined), delayMs)
    return () => clearTimeout(timeoutRef.current)
  }, [search, committedSearch, delayMs])

  const flushSearch = () => {
    clearTimeout(timeoutRef.current)
    if (search !== committedSearch) commitRef.current(search || undefined)
  }

  return { search, setSearch, flushSearch }
}
