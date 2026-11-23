import { Injectable } from '@nestjs/common'
import { centsToEur } from '../catalog/catalog.util'
import type { Topup as TopupContract } from './contracts/topup.contract'
import type { Topup } from './entities/topup.entity'

@Injectable()
export class TopupMapper {
  toTopup(topup: Topup): TopupContract {
    return {
      id: topup.id,
      amountEur: centsToEur(topup.amountCents),
      status: topup.status,
      redirectUrl: topup.redirectUrl ?? null,
      expiresAt: topup.expiresAt,
      paidAt: topup.paidAt ?? null,
    }
  }
}
