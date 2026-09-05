import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'

/**
 * Aggregation, sending, reception recording, and closing for supplier orders — the
 * `draft → sent → received / closed` state machine. Filled in per user story.
 */
@Injectable()
export class PurchasingService {
  constructor(private readonly em: EntityManager) {}
}
