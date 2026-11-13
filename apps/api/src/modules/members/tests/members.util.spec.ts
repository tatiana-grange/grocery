import { describe, expect, it } from 'vitest'
import { parseRoles, serializeRoles } from '../members.util'

/**
 * Roles live in Better Auth's single comma-separated `user.role` string, and `parseRoles`
 * drops anything it does not recognise. That makes the round-trip worth pinning: a role
 * missing from `USER_ROLES` would silently read back as a plain member, which is how a
 * distributor would quietly lose access to the table.
 */
describe('parseRoles', () => {
  it('defaults to member for an absent role', () => {
    expect(parseRoles(null)).toEqual(['member'])
    expect(parseRoles(undefined)).toEqual(['member'])
    expect(parseRoles('')).toEqual(['member'])
  })

  it('keeps the distributor role', () => {
    expect(parseRoles('member,distributor')).toEqual(['member', 'distributor'])
  })

  it('keeps the admin role', () => {
    expect(parseRoles('member,admin')).toEqual(['member', 'admin'])
  })

  it('always includes member, even when the string omits it', () => {
    expect(parseRoles('distributor')).toEqual(['member', 'distributor'])
    expect(parseRoles('admin')).toEqual(['member', 'admin'])
  })

  it('tolerates whitespace around each value', () => {
    expect(parseRoles(' member , distributor ')).toEqual(['member', 'distributor'])
  })

  it('drops a value that is not a known role', () => {
    expect(parseRoles('member,wizard')).toEqual(['member'])
    expect(parseRoles('member,distributor,wizard')).toEqual(['member', 'distributor'])
  })

  it('handles a member holding both distributor and admin', () => {
    expect(parseRoles('member,distributor,admin')).toEqual(['member', 'distributor', 'admin'])
  })
})

describe('serializeRoles', () => {
  it('round-trips a distributor', () => {
    expect(parseRoles(serializeRoles(['distributor']))).toEqual(['member', 'distributor'])
  })

  it('round-trips every role combination without losing one', () => {
    for (const roles of [
      ['member'],
      ['member', 'distributor'],
      ['member', 'admin'],
      ['member', 'distributor', 'admin'],
    ] as const) {
      expect(parseRoles(serializeRoles([...roles]))).toEqual([...roles])
    }
  })

  it('always writes member first and never duplicates it', () => {
    expect(serializeRoles(['member', 'member', 'distributor'])).toBe('member,distributor')
  })
})
