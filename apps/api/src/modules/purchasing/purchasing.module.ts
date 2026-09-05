import { Module } from '@nestjs/common'

/**
 * Lot 3 purchasing: `SupplierOrder` / `SupplierOrderLine` aggregated from pending pre-orders,
 * and `Reception` / `ReceptionLine` recording what actually arrived. Entities, contracts, the
 * migration, and controller wiring are added in the Foundational phase.
 */
@Module({})
export class PurchasingModule {}
