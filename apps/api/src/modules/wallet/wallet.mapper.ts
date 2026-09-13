import { Injectable } from '@nestjs/common'
import { centsToEur } from '../catalog/catalog.util'
import type {
  Wallet as WalletContract,
  WalletEntry as WalletEntryContract,
} from './contracts/wallet.contract'
import type { WalletEntry } from './entities/wallet-entry.entity'

@Injectable()
export class WalletMapper {
  toEntry(entry: WalletEntry): WalletEntryContract {
    return {
      id: entry.id,
      // Signed on the wire as it is in the ledger: negative charges, positive credits.
      amountEur: centsToEur(entry.amountCents),
      reason: entry.reason,
      paymentMethod: entry.paymentMethod ?? null,
      handoverId: entry.handover?.id ?? null,
      recordedBy: entry.recordedByUser?.name ?? null,
      note: entry.note ?? null,
      createdAt: entry.createdAt,
    }
  }

  toWallet(
    memberId: string,
    balanceCents: number,
    entries: WalletEntry[],
    total: number,
    pagination: { pageSize: number; offset: number },
  ): WalletContract {
    return {
      memberId,
      balanceEur: centsToEur(balanceCents),
      entries: {
        data: entries.map((entry) => this.toEntry(entry)),
        meta: {
          itemCount: total,
          pageSize: pagination.pageSize,
          offset: pagination.offset,
          hasMore: pagination.offset + pagination.pageSize < total,
        },
      },
    }
  }
}
