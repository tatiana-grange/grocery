import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/core'
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { fromNodeHeaders } from 'better-auth/node'
import { Member } from '../members/entities/member.entity'
import { parseRoles } from '../members/members.util'
import { LoggedInBetterAuthSession } from './auth.config'
import { MEMBER_SCOPED_KEY, ROLES_KEY } from './auth.decorator'
import { AuthService } from './auth.service'

export interface AuthenticatedRequest extends Request {
  session: LoggedInBetterAuthSession
}

interface SessionUserLike {
  id: string
  role?: string | null
  emailVerified?: boolean
  phoneNumberVerified?: boolean
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly em: EntityManager,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest()
      const session = await this.authService.api.getSession({
        headers: fromNodeHeaders(request.headers),
      })

      request.session = session
      request.user = session?.user ?? null // useful for observability tools like Sentry

      const isPublic = this.reflector.get('PUBLIC', context.getHandler())
      if (isPublic) return true

      const isOptional = this.reflector.get('OPTIONAL', context.getHandler())
      if (isOptional && !session) return true

      if (!session) throw new UnauthorizedException()

      const user = session.user as SessionUserLike
      const roles = parseRoles(user.role)
      const isAdmin = roles.includes('admin')

      const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
      if (requiredRoles?.length) {
        if (!requiredRoles.some((role) => roles.includes(role as (typeof roles)[number]))) {
          throw new ForbiddenException('You do not have access to this resource')
        }
        return true
      }

      const isMemberScoped = this.reflector.getAllAndOverride<boolean | undefined>(
        MEMBER_SCOPED_KEY,
        [context.getHandler(), context.getClass()],
      )
      if (isMemberScoped) {
        const hasConfirmedIdentifier = Boolean(user.emailVerified || user.phoneNumberVerified)
        if (!hasConfirmedIdentifier) {
          throw new ForbiddenException('Confirm your email or phone number first')
        }

        // Admins reach member-scoped routes regardless of their own member status, so only
        // pay for the lookup when the active-status check actually gates access. Handlers
        // that need the member load it themselves (via MembersService).
        if (!isAdmin) {
          const member = await this.em.findOne(Member, { user: user.id })
          if (member?.status !== 'active') {
            throw new ForbiddenException(
              member ? `Your membership is ${member.status}` : 'You are not an active member',
            )
          }
        }
      }

      return true
    } catch (error) {
      if (error instanceof ForbiddenException) throw error
      if (error instanceof UnauthorizedException) throw error
      console.error(error)
      throw new UnauthorizedException()
    }
  }
}
