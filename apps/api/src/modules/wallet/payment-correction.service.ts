import { Injectable } from '@nestjs/common'
import type { CorrectPaymentInput } from './contracts/wallet.contract'
import { MemberNoticeService } from './member-notice.service'
import { WalletService } from './wallet.service'

/**
 * The staff action "correct a payment": the ledger write, then, once it has committed, the
 * notice e-mails when the member ends below zero. A mail problem never undoes a correction:
 * `notifyNegativeBalance` never rejects, and it runs after the transaction has closed.
 */
@Injectable()
export class PaymentCorrectionService {
  constructor(
    private readonly wallet: WalletService,
    private readonly notice: MemberNoticeService,
  ) {}

  async correct(
    memberId: string,
    entryId: string,
    input: CorrectPaymentInput,
    staffUserId: string,
  ): Promise<void> {
    const { balanceAfterCents } = await this.wallet.correctPayment(
      memberId,
      entryId,
      input,
      staffUserId,
    )
    if (balanceAfterCents < 0) {
      await this.notice.notifyNegativeBalance(memberId, balanceAfterCents)
    }
  }
}
