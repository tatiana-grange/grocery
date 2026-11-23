import { EntityManager, LockMode, UniqueConstraintViolationException } from '@mikro-orm/core'
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { config } from '../../config/env.config'
import { eurToCents } from '../catalog/catalog.util'
import { Member } from '../members/entities/member.entity'
import { MemberNoticeService } from '../wallet/member-notice.service'
import { WalletService } from '../wallet/wallet.service'
import {
  TOPUP_MAX_EUR,
  TOPUP_MIN_EUR,
  TOPUP_QUICK_AMOUNTS_EUR,
  type TopupOptions,
} from './contracts/topup.contract'
import { Topup } from './entities/topup.entity'
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  PaymentProviderError,
  type PaymentResult,
} from './providers/payment-provider'

/** How long a payment request stays valid at the provider, until it tells us its own value. */
const TOPUP_VALIDITY_MS = 15 * 60 * 1000

/** The notification only looks at top-ups started in this window. */
const RECONCILE_WINDOW_MS = 30 * 60 * 1000

/** At most this many top-ups are checked per notification. */
const RECONCILE_BATCH_SIZE = 20

/** A top-up the provider was asked about more recently than this is skipped by the sweep. */
const RECONCILE_MIN_INTERVAL_MS = 5 * 1000

/** How long past its expiry a request the provider still calls pending is given before `expired`. */
const EXPIRY_GRACE_MS = 5 * 60 * 1000

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)

  constructor(
    private readonly em: EntityManager,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly wallet: WalletService,
    private readonly notice: MemberNoticeService,
  ) {}

  getOptions(): TopupOptions {
    return {
      enabled: this.provider.isEnabled,
      minAmountEur: TOPUP_MIN_EUR,
      maxAmountEur: TOPUP_MAX_EUR,
      quickAmountsEur: TOPUP_QUICK_AMOUNTS_EUR,
    }
  }

  /**
   * Starts an online top-up: stores a pending `Topup`, asks the provider for a payment request
   * and keeps what it answers. Nothing is credited here. A negative balance is never checked.
   */
  async startTopup(userId: string, amountEur: number): Promise<Topup> {
    this.assertEnabled()

    // The role check of the route lets an admin through whatever their member status, so the
    // status is checked here too.
    const member = await this.em.findOne(Member, { user: userId })
    if (member?.status !== 'active') {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Only active members can top up',
        code: 'member_not_active',
      })
    }

    const amountCents = this.toValidAmountCents(amountEur)

    const topup = new Topup()
    topup.member = member
    topup.amountCents = amountCents
    topup.expiresAt = new Date(Date.now() + TOPUP_VALIDITY_MS)
    await this.em.persist(topup).flush()

    const returnUrl = `${config.clients.webApp.url}/account/topup/return?topup=${topup.id}`
    try {
      const created = await this.provider.createPaymentRequest({
        topupId: topup.id,
        amountCents,
        description: 'Rechargement du compte',
        returnUrl,
        backUrl: `${returnUrl}&from=back`,
        errorUrl: `${returnUrl}&from=error`,
      })
      topup.providerRequestId = created.providerRequestId
      topup.redirectUrl = created.redirectUrl
      topup.expiresAt = created.expiresAt
      await this.em.flush()
      return topup
    } catch (error) {
      if (!(error instanceof PaymentProviderError)) throw error
      topup.status = 'failed'
      await this.em.flush()
      throw this.providerUnavailable()
    }
  }

  /**
   * What a provider notification does. It reads nothing from the notification: it asks the
   * provider about our own recent unfinished top-ups. The window, the cap and the minimum
   * interval per top-up are the only bound on what an anonymous caller can make us do.
   * A failure on one top-up is logged and does not stop the others.
   */
  async reconcileRecent(): Promise<void> {
    if (!this.provider.isEnabled) return

    const now = Date.now()
    const candidates = await this.em.find(
      Topup,
      {
        status: 'pending',
        providerRequestId: { $ne: null },
        createdAt: { $gt: new Date(now - RECONCILE_WINDOW_MS) },
        $or: [
          { lastCheckedAt: null },
          { lastCheckedAt: { $lt: new Date(now - RECONCILE_MIN_INTERVAL_MS) } },
        ],
      },
      { orderBy: { createdAt: 'asc' }, limit: RECONCILE_BATCH_SIZE },
    )

    // Stamp the check time first. If the provider is down the answer never comes, and without
    // this stamp every nudge would ask again at once.
    const stampedAt = new Date()
    for (const candidate of candidates) candidate.lastCheckedAt = stampedAt
    await this.em.flush()

    for (const candidate of candidates) {
      try {
        await this.verify(candidate.id)
      } catch (error) {
        this.logger.error(
          `Could not check top-up ${candidate.id}: ${error instanceof Error ? error.message : error}`,
        )
      }
    }
  }

  /** The member's own top-up, as stored. Asks nobody. Someone else's id reads as not found. */
  async getTopup(userId: string, topupId: string): Promise<Topup> {
    const topup = await this.em.findOne(Topup, { id: topupId, member: { user: userId } })
    if (!topup) throw new NotFoundException('Top-up not found')
    return topup
  }

  /** The member asks for the payment result. Credits if the provider confirms it. */
  async verifyTopup(userId: string, topupId: string): Promise<Topup> {
    this.assertEnabled()
    const topup = await this.getTopup(userId, topupId)
    return this.verify(topup.id)
  }

  /**
   * The one place that can credit. The provider is asked first, outside any transaction. A
   * short transaction then locks the top-up row, re-reads it and writes the credit and the
   * paid state together, so a second caller waits, sees `paid` and writes nothing. The unique
   * provider payment id on the top-up and on the entry is the backstop behind the lock.
   *
   * The credited amount is always the requested one. The paid amount is only checked.
   */
  private async verify(topupId: string): Promise<Topup> {
    const topup = await this.em.findOneOrFail(Topup, { id: topupId }, { refresh: true })
    // `paid` and `failed` are final. `expired` is not: a payer can pay at the last second.
    if (topup.status === 'paid' || topup.status === 'failed') return topup
    // The start never reached the provider, so there is nothing to ask.
    if (!topup.providerRequestId) return topup

    let result: PaymentResult
    try {
      result = await this.provider.getPaymentResult(topup.providerRequestId)
    } catch (error) {
      if (!(error instanceof PaymentProviderError)) throw error
      throw this.providerUnavailable()
    }

    let underpaid = null as { memberId: string; paidCents: number } | null
    try {
      const topup = await this.em.transactional(async (tem) => {
        const locked = await tem.findOneOrFail(
          Topup,
          { id: topupId },
          { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true, populate: ['member'] },
        )
        if (locked.status === 'paid') return locked

        const now = new Date()
        locked.lastCheckedAt = now
        if (result.status === 'paid') {
          if (result.paidAmountCents < locked.amountCents) {
            // A real payment must never be marked lost by our own code: leave the status, say
            // so loudly, credit nothing.
            this.logger.error(
              `Top-up ${locked.id} was paid ${result.paidAmountCents} cents, less than the ` +
                `${locked.amountCents} requested. Nothing was credited.`,
            )
            // Stamped in this locked transaction, before any mail, so a second check that
            // waits on the lock reads the stamp and sends nothing.
            if (!locked.underpaidNotifiedAt) {
              locked.underpaidNotifiedAt = now
              underpaid = { memberId: locked.member.id, paidCents: result.paidAmountCents }
            }
          } else {
            const entry = this.wallet.credit(tem, {
              memberId: locked.member.id,
              amountCents: locked.amountCents,
              reason: 'online_topup',
              paymentMethod: 'online',
              providerPaymentId: result.providerPaymentId,
            })
            locked.status = 'paid'
            locked.paidAt = now
            locked.providerPaymentId = result.providerPaymentId
            locked.walletEntry = entry
          }
        } else if (result.status === 'failed') {
          locked.status = 'failed'
        } else if (now.getTime() > locked.expiresAt.getTime() + EXPIRY_GRACE_MS) {
          locked.status = 'expired'
        }
        return locked
      })
      // After the commit, so a mail problem can never undo anything. A failed send is logged
      // with the top-up id and is not retried.
      if (underpaid) {
        const { memberId, paidCents } = underpaid
        await this.notice.notifyUnderpaidTopup({
          memberId,
          requestedCents: topup.amountCents,
          paidCents,
          topupId: topup.id,
        })
      }
      return topup
    } catch (error) {
      // The backstop: this provider payment is already on another entry or top-up.
      if (!(error instanceof UniqueConstraintViolationException)) throw error
      this.logger.error(
        `Top-up ${topupId}: provider payment already credited elsewhere. Nothing was credited.`,
      )
      return this.em.findOneOrFail(Topup, { id: topupId }, { refresh: true })
    }
  }

  private assertEnabled(): void {
    if (this.provider.isEnabled) return
    throw new ServiceUnavailableException({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'Online payment is not available',
      code: 'payments_disabled',
    })
  }

  private providerUnavailable() {
    return new BadGatewayException({
      statusCode: HttpStatus.BAD_GATEWAY,
      message: 'The payment service is not answering',
      code: 'provider_unavailable',
    })
  }

  /** Euros to cents, refusing what the form should never send, with an explicit code. */
  private toValidAmountCents(amountEur: number): number {
    const cents = amountEur * 100
    // More than two decimals is refused, never silently rounded.
    if (Math.abs(cents - Math.round(cents)) > 1e-6) {
      throw this.badAmount('amount_invalid', 'Enter an amount with at most two decimals')
    }
    const amountCents = eurToCents(amountEur)
    if (amountCents < TOPUP_MIN_EUR * 100) {
      throw this.badAmount('amount_too_low', `The minimum amount is ${TOPUP_MIN_EUR} euros`)
    }
    if (amountCents > TOPUP_MAX_EUR * 100) {
      throw this.badAmount('amount_too_high', `The maximum amount is ${TOPUP_MAX_EUR} euros`)
    }
    return amountCents
  }

  private badAmount(code: string, message: string) {
    return new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
      code,
      minAmountEur: TOPUP_MIN_EUR,
      maxAmountEur: TOPUP_MAX_EUR,
    })
  }
}
