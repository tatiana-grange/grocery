/** The message of a caught value, for a log line. */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error'
}
