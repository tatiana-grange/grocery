import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'

/**
 * Writes `StockMovement` rows (one per reception line, called from within the purchasing
 * reception transaction) and derives stock level and weighted average cost price from them
 * by aggregate query at read time — never stored on `Product`.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly em: EntityManager) {}
}
