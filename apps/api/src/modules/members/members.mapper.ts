import { Injectable } from '@nestjs/common'
import { User } from '../auth/auth.entity'
import {
  MEMBERSHIP_FEE_STATES,
  type FeeSummary,
  type MembershipFeeState,
} from './contracts/member.contract'
import { MembershipFee } from './entities/membership-fee.entity'
import { parseRoles } from './members.util'

@Injectable()
export class MembersMapper {
  /** Derives the fee state from the expected amount and the sum of recorded payments. */
  static deriveFeeState(expectedAmountCents: number, paidAmountCents: number): MembershipFeeState {
    if (paidAmountCents <= 0) return MEMBERSHIP_FEE_STATES[0] // unpaid
    if (paidAmountCents < expectedAmountCents) return MEMBERSHIP_FEE_STATES[1] // partly_paid
    return MEMBERSHIP_FEE_STATES[2] // paid
  }

  toFeeSummary(fee: MembershipFee | undefined): FeeSummary {
    const expectedAmountCents = fee?.expectedAmountCents ?? 0
    const paidAmountCents =
      fee && fee.payments.isInitialized()
        ? fee.payments.getItems().reduce((sum, payment) => sum + payment.amountCents, 0)
        : 0

    return {
      expectedAmountCents,
      paidAmountCents,
      state: MembersMapper.deriveFeeState(expectedAmountCents, paidAmountCents),
    }
  }

  rolesOf(user: User): ReturnType<typeof parseRoles> {
    return parseRoles(user.role)
  }
}
