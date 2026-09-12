import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator, SetMetadata } from '@nestjs/common'

export const BEFORE_HOOK_KEY = Symbol('BEFORE_HOOK')
export const AFTER_HOOK_KEY = Symbol('AFTER_HOOK')
export const HOOK_KEY = Symbol('HOOK')

export const Public = () => SetMetadata('PUBLIC', true)
export const Optional = () => SetMetadata('OPTIONAL', true)

export const ROLES_KEY = 'ROLES'
export const MEMBER_SCOPED_KEY = 'MEMBER_SCOPED'

/**
 * Require the current user to hold at least one of the given roles.
 * Generic, so a new role needs no change to the guard.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)

/** Shorthand for `@Roles('admin')` — back-office only. */
export const AdminOnly = () => SetMetadata(ROLES_KEY, ['admin'])

/**
 * Shorthand for `@Roles('distributor', 'admin')` — the distribution table.
 *
 * An admin passes without carrying `distributor` in their role string, matching how `admin`
 * is already a superset of `member`. The consequence, chosen deliberately in research.md §2:
 * distribution cannot be revoked from an admin without removing `admin` itself.
 */
export const StaffOnly = () => SetMetadata(ROLES_KEY, ['distributor', 'admin'])

/**
 * Require the caller to be an active cooperative member with a confirmed identifier.
 * Admins bypass the active-status check (an admin is a member "plus").
 */
export const MemberScoped = () => SetMetadata(MEMBER_SCOPED_KEY, true)

export const Session = createParamDecorator((_data: never, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest()
  return request.session
})

export function BeforeHook(path: `/${string}`) {
  return SetMetadata(BEFORE_HOOK_KEY, path)
}

export function AfterHook(path: `/${string}`) {
  return SetMetadata(AFTER_HOOK_KEY, path)
}

export const Hook = () => SetMetadata(HOOK_KEY, true)
