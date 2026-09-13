import {
  PaginationParams,
  TypedBody,
  TypedController,
  TypedParam,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { MemberScoped, Session, StaffOnly } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import { eurToCents } from '../catalog/catalog.util'
import {
  type RecordPaymentInput,
  recordPaymentSchema,
  type WalletPagination,
  walletPaginationSchema,
  walletSchema,
} from './contracts/wallet.contract'
import { WalletMapper } from './wallet.mapper'
import { WalletService } from './wallet.service'

/**
 * What the distribution table needs: read a member's account, and record money they hand
 * over. `@StaffOnly()` — a distributor or an admin.
 */
@TypedController('wallet', undefined, { tags: ['Wallet'] })
@UseGuards(AuthGuard)
@StaffOnly()
export class StaffWalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly mapper: WalletMapper,
  ) {}

  @TypedRoute.Get('members/:memberId', walletSchema)
  async getWallet(
    @TypedParam('memberId', z.string()) memberId: string,
    @PaginationParams(walletPaginationSchema) pagination: WalletPagination,
  ) {
    const member = await this.wallet.getMember(memberId)
    return this.buildWallet(member.id, pagination)
  }

  /**
   * Records money received. Returns the updated wallet so the table can retry a refused
   * handover straight away, without a refetch (SC-011).
   */
  @TypedRoute.Post('members/:memberId/payments', walletSchema)
  async recordPayment(
    @TypedParam('memberId', z.string()) memberId: string,
    @TypedBody(recordPaymentSchema) body: RecordPaymentInput,
    @Session() session: LoggedInBetterAuthSession,
    @PaginationParams(walletPaginationSchema) pagination: WalletPagination,
  ) {
    const member = await this.wallet.getMember(memberId)
    await this.wallet.recordPayment(
      member.id,
      {
        amountCents: eurToCents(body.amountEur),
        paymentMethod: body.paymentMethod,
        note: body.note,
      },
      session.user.id,
    )
    return this.buildWallet(member.id, pagination)
  }

  private async buildWallet(memberId: string, pagination: WalletPagination) {
    const [balanceCents, { items, total }] = await Promise.all([
      this.wallet.getBalanceCents(this.wallet.entityManager, memberId),
      this.wallet.listEntries(memberId, pagination),
    ])
    return this.mapper.toWallet(memberId, balanceCents, items, total, pagination)
  }
}

/**
 * A member reading their own account, and nobody else's (FR-023). There is deliberately no
 * member-facing route that takes another member's id.
 */
@TypedController('me/wallet', undefined, { tags: ['Wallet'] })
@UseGuards(AuthGuard)
@MemberScoped()
export class MemberWalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly mapper: WalletMapper,
  ) {}

  @TypedRoute.Get('', walletSchema)
  async getOwnWallet(
    @Session() session: LoggedInBetterAuthSession,
    @PaginationParams(walletPaginationSchema) pagination: WalletPagination,
  ) {
    const member = await this.wallet.getMemberForUser(session.user.id)
    const [balanceCents, { items, total }] = await Promise.all([
      this.wallet.getBalanceCents(this.wallet.entityManager, member.id),
      this.wallet.listEntries(member.id, pagination),
    ])
    return this.mapper.toWallet(member.id, balanceCents, items, total, pagination)
  }
}
