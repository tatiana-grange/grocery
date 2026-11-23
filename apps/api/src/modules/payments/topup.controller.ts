import { TypedBody, TypedController, TypedParam, TypedRoute } from '@lonestone/nzoth/server'
import { HttpCode, HttpStatus, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { MemberScoped, Public, Session } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import {
  type StartTopupInput,
  notificationAckSchema,
  startTopupSchema,
  topupOptionsSchema,
  topupSchema,
} from './contracts/topup.contract'
import { PaymentsService } from './payments.service'
import { TopupMapper } from './topup.mapper'

/** A member topping up their own account. Never takes another member's id. */
@TypedController('me/topups', undefined, { tags: ['Payments'] })
@UseGuards(AuthGuard)
@MemberScoped()
export class MemberTopupController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly mapper: TopupMapper,
  ) {}

  /** Declared before any `:topupId` route so "options" is never read as an id. */
  @TypedRoute.Get('options', topupOptionsSchema)
  getOptions() {
    return this.payments.getOptions()
  }

  @TypedRoute.Post('', topupSchema)
  async start(
    @TypedBody(startTopupSchema) body: StartTopupInput,
    @Session() session: LoggedInBetterAuthSession,
  ) {
    const topup = await this.payments.startTopup(session.user.id, body.amountEur)
    return this.mapper.toTopup(topup)
  }

  /** The stored state only. It never asks the provider and never credits. */
  @TypedRoute.Get(':topupId', topupSchema)
  async get(
    @TypedParam('topupId', z.string().uuid()) topupId: string,
    @Session() session: LoggedInBetterAuthSession,
  ) {
    return this.mapper.toTopup(await this.payments.getTopup(session.user.id, topupId))
  }

  /** The member asks for the payment result. Credits the account if the provider confirms it. */
  @TypedRoute.Post(':topupId/verification', topupSchema)
  @HttpCode(HttpStatus.OK)
  async verify(
    @TypedParam('topupId', z.string().uuid()) topupId: string,
    @Session() session: LoggedInBetterAuthSession,
  ) {
    return this.mapper.toTopup(await this.payments.verifyTopup(session.user.id, topupId))
  }
}

/**
 * Where HelloAsso tells us something happened. Public, and it carries no trust: the body is
 * never read (the route declares no body), so a payload that claims a payment is no reason to
 * credit. The notification only nudges us to ask the provider about our own recent unfinished
 * top-ups.
 *
 * There is no rate limiter in this API to reuse. The bound is in `reconcileRecent`: a 5-second
 * pause per top-up and at most 20 top-ups per pass.
 */
@TypedController('payments/notifications', undefined, { tags: ['Payments'] })
@UseGuards(AuthGuard)
@Public()
export class PaymentNotificationController {
  constructor(private readonly payments: PaymentsService) {}

  @TypedRoute.Post('helloasso', notificationAckSchema)
  @HttpCode(HttpStatus.OK)
  async helloasso() {
    await this.payments.reconcileRecent()
    return { received: true as const }
  }
}
