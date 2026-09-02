/**
 * Helpers for the generated client's error shape. A 409 means the record changed since it
 * was loaded (optimistic-concurrency) — the caller should prompt the user to reload.
 */

interface ApiErrorLike {
  statusCode?: number
  status?: number
  message?: string
}

export function isConflict(error: unknown): boolean {
  const candidate = error as ApiErrorLike | undefined
  return candidate?.statusCode === 409 || candidate?.status === 409
}

/** A 403 means the request was understood but the caller is not allowed (e.g. not an active member). */
export function isForbidden(error: unknown): boolean {
  const candidate = error as ApiErrorLike | undefined
  return candidate?.statusCode === 403 || candidate?.status === 403
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as ApiErrorLike | undefined
  return candidate?.message ?? fallback
}

/**
 * Standard mutation error handler: a 409 gets the "reload and try again" message, everything
 * else gets the given fallback. Pass a `toast.error`-style function and the two i18n strings.
 */
export function handleMutationError(
  error: unknown,
  showError: (message: string) => void,
  messages: { conflict: string; fallback: string },
): void {
  showError(isConflict(error) ? messages.conflict : messages.fallback)
}
