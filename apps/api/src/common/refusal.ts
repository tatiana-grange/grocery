import { ConflictException, HttpStatus } from '@nestjs/common'

/**
 * A 409 the generated client can read. `statusCode` is set on purpose: passing an object body to
 * `ConflictException` replaces Nest's default `{ statusCode, message, error }`, and the client's
 * `isConflict` helper keys off `statusCode`.
 */
export function conflict(message: string, extra: Record<string, unknown> = {}): ConflictException {
  return new ConflictException({ statusCode: HttpStatus.CONFLICT, message, ...extra })
}

/** A 409 that also carries a `code`, so the client can branch on it without reading the message. */
export function refusal(
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): ConflictException {
  return conflict(message, { code, ...extra })
}
