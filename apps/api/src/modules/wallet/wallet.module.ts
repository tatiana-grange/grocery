import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { WalletEntry } from './entities/wallet-entry.entity'
import { WalletService } from './wallet.service'

/**
 * Lot 4 wallet: `WalletEntry`, the append-only ledger a member's balance is summed from.
 * `WalletService` is exported so the distribution module can charge and credit inside its
 * own handover transaction, the same way `InventoryModule` exports `InventoryService`.
 * The controllers are registered in US4.
 */
@Module({
  imports: [MikroOrmModule.forFeature([WalletEntry])],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
