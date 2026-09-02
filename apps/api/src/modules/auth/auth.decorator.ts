import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator, SetMetadata } from '@nestjs/common'

export const BEFORE_HOOK_KEY = Symbol('BEFORE_HOOK')
export const AFTER_HOOK_KEY = Symbol('AFTER_HOOK')
export const HOOK_KEY = Symbol('HOOK')

export const Public = () => SetMetadata('PUBLIC', true)
export const Optional = () => SetMetadata('OPTIONAL', true)

export const ROLES_KEY = 'ROLES'

/**
 * Require the current user to hold at least one of the given roles.
 * Generic so lot 4 can add `@Roles('grocer')` without touching the guard.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)

/** Shorthand for `@Roles('admin')` — back-office only. */
export const AdminOnly = () => SetMetadata(ROLES_KEY, ['admin'])

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
