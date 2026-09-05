/** Throws the generated client's error, or returns its data — shared across every `*-queries.ts` file. */
export function unwrap<T>(response: { data?: T; error?: unknown }): T {
  if (response.error) throw response.error
  return response.data as T
}
