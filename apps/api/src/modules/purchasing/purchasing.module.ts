import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { EmailModule } from '../email/email.module'
import { InventoryModule } from '../inventory/inventory.module'
import {
  AdminPurchasingController,
  AdminSupplierPurchasingController,
} from './purchasing.controller'
import { Reception } from './entities/reception.entity'
import { ReceptionLine } from './entities/reception-line.entity'
import { SupplierOrder } from './entities/supplier-order.entity'
import { SupplierOrderLine } from './entities/supplier-order-line.entity'
import { PurchasingMapper } from './purchasing.mapper'
import { PurchasingService } from './purchasing.service'
import { SupplierOrderMailService } from './supplier-order-mail.service'
import { SupplierOrderNoticeService } from './supplier-order-notice.service'

/**
 * Lot 3 purchasing: `SupplierOrder` / `SupplierOrderLine` aggregated from pending pre-orders,
 * and `Reception` / `ReceptionLine` recording what actually arrived. Imports `InventoryModule`
 * so reception recording can write stock movements and mappers can read cost-price estimates.
 * Controllers are registered per user story.
 */
@Module({
  imports: [
    MikroOrmModule.forFeature([SupplierOrder, SupplierOrderLine, Reception, ReceptionLine]),
    InventoryModule,
    EmailModule,
  ],
  controllers: [AdminSupplierPurchasingController, AdminPurchasingController],
  providers: [
    PurchasingService,
    PurchasingMapper,
    SupplierOrderMailService,
    SupplierOrderNoticeService,
  ],
  exports: [PurchasingService, SupplierOrderMailService, SupplierOrderNoticeService],
})
export class PurchasingModule {}
