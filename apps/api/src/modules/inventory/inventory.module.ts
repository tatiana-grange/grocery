import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { StockMovement } from './entities/stock-movement.entity'
import { InventoryController } from './inventory.controller'
import { InventoryMapper } from './inventory.mapper'
import { InventoryService } from './inventory.service'

/**
 * Lot 3 inventory: `StockMovement`, the append-only ledger a product's stock level and
 * weighted average cost price are derived from. `InventoryService` is exported so the
 * purchasing module can record receipts within its reception transaction. The read-only
 * stock controller is registered in US4.
 */
@Module({
  imports: [MikroOrmModule.forFeature([StockMovement])],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryMapper],
  exports: [InventoryService],
})
export class InventoryModule {}
