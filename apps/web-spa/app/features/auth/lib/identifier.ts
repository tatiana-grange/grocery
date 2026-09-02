/**
 * A person signs up with an email address or a phone number. Because the backend keeps
 * `user.email` NOT NULL, a phone-only account is created with a synthesized hidden address;
 * the person never sees or uses it.
 */

export const PHONE_EMAIL_DOMAIN = 'phone.grocery.local'

export type IdentifierMode = 'email' | 'phone'

/** Digits only, keeping a leading `+`. */
export function normalizePhone(input: string): string {
  const trimmed = input.trim()
  const plus = trimmed.startsWith('+') ? '+' : ''
  return plus + trimmed.replace(/[^0-9]/g, '')
}

export function synthesizedEmailFor(phoneNumber: string): string {
  return `${normalizePhone(phoneNumber).replace(/[^0-9]/g, '')}@${PHONE_EMAIL_DOMAIN}`
}

export function isLikelyPhone(value: string): boolean {
  const trimmed = value.trim()
  if (!/^\+?[0-9\s().-]+$/.test(trimmed)) return false
  return trimmed.replace(/[^0-9]/g, '').length >= 6
}
