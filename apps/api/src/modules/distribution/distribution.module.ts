import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { InventoryModule } from '../inventory/inventory.module'
import { WalletModule } from '../wallet/wallet.module'
import { DistributionController } from './distribution.controller'
import { DistributionMapper } from './distribution.mapper'
import { DistributionService } from './distribution.service'
import { Handover } from './entities/handover.entity'
import { HandoverLine } from './entities/handover-line.entity'

/**
 * Lot 4 distribution: the table screen, the write-once `Handover` / `HandoverLine` records,
 * the express order, and the reversal. Imports `WalletModule` and `InventoryModule` so a
 * handover can charge the member and move stock inside one transaction — the same shape
 * `PurchasingModule` already uses for receptions. Service, mapper and controller are
 * registered per user story.
 */
@Module({
  imports: [MikroOrmModule.forFeature([Handover, HandoverLine]), WalletModule, InventoryModule],
  controllers: [DistributionController],
  providers: [DistributionService, DistributionMapper],
  exports: [DistributionService],
})
export class DistributionModule {}
