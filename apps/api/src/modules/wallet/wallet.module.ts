import { Module } from '@nestjs/common'

/**
 * Lot 4 wallet: `WalletEntry`, the append-only ledger a member's balance is summed from.
 * `WalletService` is exported so the distribution module can charge and credit inside its
 * own handover transaction, the same way `InventoryModule` exports `InventoryService`.
 */
@Module({})
export class WalletModule {}
