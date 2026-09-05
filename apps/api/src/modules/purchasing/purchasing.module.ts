import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { InventoryModule } from '../inventory/inventory.module'
import { Reception } from './entities/reception.entity'
import { ReceptionLine } from './entities/reception-line.entity'
import { SupplierOrder } from './entities/supplier-order.entity'
import { SupplierOrderLine } from './entities/supplier-order-line.entity'
import { PurchasingMapper } from './purchasing.mapper'
import { PurchasingService } from './purchasing.service'

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
  ],
  providers: [PurchasingService, PurchasingMapper],
  exports: [PurchasingService],
})
export class PurchasingModule {}
