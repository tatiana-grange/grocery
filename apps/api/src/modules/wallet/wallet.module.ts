import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { EmailModule } from '../email/email.module'
import { MemberWalletController, StaffWalletController } from './wallet.controller'
import { WalletEntry } from './entities/wallet-entry.entity'
import { MemberNoticeService } from './member-notice.service'
import { PurchaseGuard } from './purchase-guard'
import { PaymentCorrectionService } from './payment-correction.service'
import { WalletMapper } from './wallet.mapper'
import { WalletService } from './wallet.service'

/**
 * Lot 4 wallet: `WalletEntry`, the append-only ledger a member's balance is summed from.
 * `WalletService` is exported so the distribution module can charge and credit inside its
 * own handover transaction, the same way `InventoryModule` exports `InventoryService`.
 * The controllers are registered in US4.
 */
@Module({
  imports: [MikroOrmModule.forFeature([WalletEntry]), EmailModule],
  controllers: [StaffWalletController, MemberWalletController],
  providers: [
    WalletService,
    WalletMapper,
    PaymentCorrectionService,
    MemberNoticeService,
    PurchaseGuard,
  ],
  exports: [WalletService, PurchaseGuard, MemberNoticeService],
})
export class WalletModule {}
