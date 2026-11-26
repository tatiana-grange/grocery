import { EntityManager, LockMode } from '@mikro-orm/core'
import { EnsureRequestContext } from '@mikro-orm/decorators/legacy'
import { Injectable, Logger } from '@nestjs/common'
import { startOfParisDay, toParisDay } from '../../common/paris-time.util'
import { Supplier } from '../catalog/entities/supplier.entity'
import {
  findDueDistributions,
  previousDistribution,
  readOrderScheduleRule,
  type OrderScheduleRule,
  type ScheduledDistribution,
} from '../catalog/order-schedule.util'
import { SupplierOrder } from './entities/supplier-order.entity'
import { PurchasingService } from './purchasing.service'
import { OrderMailError, SupplierOrderMailService } from './supplier-order-mail.service'
import { SupplierOrderNoticeService } from './supplier-order-notice.service'

export interface ScheduleRunOutcome {
  supplierId: string
  result:
    | 'not_due'
    | 'locked_elsewhere'
    | 'already_sent'
    | 'nothing_to_order'
    | 'sent'
    | 'partly_failed'
    | 'missed'
  distributionDay?: string
}

/** The admin mails of one supplier's pass. They leave after the transaction has committed. */
interface AfterCommit {
  summary?: { distributionDay: string; lineCount: number; orderCount: number }
  failures: { orderId: string; reason: 'no_address' | 'mail_error' }[]
  missedDay?: string
}

/**
 * The automatic run. Called with "now" on each tick of the job, and by the tests with fixed
 * instants. For each supplier whose schedule is on it handles each distribution at most once:
 * the distribution day is written on the supplier first, in the same transaction and under a
 * row lock, so a tick that comes again, or a second API process, finds it handled.
 */
@Injectable()
export class SupplierOrderScheduleService {
  private readonly logger = new Logger(SupplierOrderScheduleService.name)

  constructor(
    private readonly em: EntityManager,
    private readonly purchasing: PurchasingService,
    private readonly orderMail: SupplierOrderMailService,
    private readonly notices: SupplierOrderNoticeService,
  ) {}

  /**
   * One pass over every supplier whose schedule is on. Never rejects: a supplier that throws
   * is logged and the pass goes on.
   */
  @EnsureRequestContext()
  async runDue(now: Date): Promise<ScheduleRunOutcome[]> {
    const outcomes: ScheduleRunOutcome[] = []
    let supplierIds: string[]
    try {
      const suppliers = await this.em.find(
        Supplier,
        { scheduleEnabled: true, archivedAt: null },
        { fields: ['id'], orderBy: { name: 'asc' } },
      )
      supplierIds = suppliers.map((supplier) => supplier.id)
    } catch (error) {
      this.logger.error(`Automatic run: could not list the suppliers: ${describe(error)}`)
      return outcomes
    }

    for (const supplierId of supplierIds) {
      try {
        outcomes.push(await this.runSupplier(supplierId, now))
      } catch (error) {
        this.logger.error(`Automatic run failed for supplier ${supplierId}: ${describe(error)}`)
      }
    }
    return outcomes
  }

  private async runSupplier(supplierId: string, now: Date): Promise<ScheduleRunOutcome> {
    const after: AfterCommit = { failures: [] }
    let supplierName = ''

    const outcome = await this.em.transactional(async (em): Promise<ScheduleRunOutcome> => {
      const supplier = await em.findOne(
        Supplier,
        { id: supplierId },
        { lockMode: LockMode.PESSIMISTIC_PARTIAL_WRITE },
      )
      // `SKIP LOCKED`: no row means another process holds the supplier right now.
      if (!supplier) return { supplierId, result: 'locked_elsewhere' }
      supplierName = supplier.name

      const rule = readOrderScheduleRule(supplier)
      if (
        !supplier.scheduleEnabled ||
        supplier.archivedAt ||
        !rule ||
        !supplier.scheduleActiveSince
      ) {
        return { supplierId, result: 'not_due' }
      }

      const { missed, due } = findDueDistributions({
        rule,
        now,
        handledDay: handledDayOf(supplier),
        activeSince: supplier.scheduleActiveSince,
      })
      if (!missed && !due) return { supplierId, result: 'not_due' }

      // A handled distribution is never tried again, whatever happens next.
      supplier.scheduleHandledDay = (due ?? missed)!.distributionDay
      await em.flush()

      let outcome: ScheduleRunOutcome | null = null
      if (missed && !(await this.alreadySent(em, supplier, rule, missed))) {
        after.missedDay = missed.distributionDay
        outcome = { supplierId, result: 'missed', distributionDay: missed.distributionDay }
      }
      if (!due) return outcome ?? { supplierId, result: 'already_sent' }

      if (await this.alreadySent(em, supplier, rule, due)) {
        return (
          outcome ?? { supplierId, result: 'already_sent', distributionDay: due.distributionDay }
        )
      }
      return this.sendDue(em, supplier, due, after)
    })

    await this.notifyAfterCommit(supplierName, after)
    return outcome
  }

  /** An order of this supplier sent since 00:00 Paris on the previous distribution day. */
  private async alreadySent(
    em: EntityManager,
    supplier: Supplier,
    rule: OrderScheduleRule,
    distribution: ScheduledDistribution,
  ): Promise<boolean> {
    const previous = previousDistribution(rule, distribution.distributionDay)
    const count = await em.count(SupplierOrder, {
      supplier: supplier.id,
      sentAt: { $gte: startOfParisDay(previous.distributionDay) },
    })
    return count > 0
  }

  /** Gathers the pending lines, then mails every draft of the supplier, one e-mail each. */
  private async sendDue(
    em: EntityManager,
    supplier: Supplier,
    due: ScheduledDistribution,
    after: AfterCommit,
  ): Promise<ScheduleRunOutcome> {
    const { orderable } = await this.purchasing.collectPendingLines(em, supplier)
    if (orderable.length > 0) {
      this.purchasing.createDraft(em, supplier, orderable)
      await em.flush()
    }

    const drafts = await em.find(
      SupplierOrder,
      { supplier: supplier.id, status: 'draft' },
      { orderBy: { createdAt: 'asc' }, lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    if (drafts.length === 0) {
      return {
        supplierId: supplier.id,
        result: 'nothing_to_order',
        distributionDay: due.distributionDay,
      }
    }
    await em.populate(drafts, [
      'supplier',
      'supplier.referent',
      'supplier.referent.user',
      'lines',
      'lines.product',
    ])

    let sentOrders = 0
    let sentLines = 0
    for (const draft of drafts) {
      try {
        const result = await this.orderMail.sendOrder(draft)
        if (result.sentTo === null) {
          after.failures.push({ orderId: draft.id, reason: 'no_address' })
          continue
        }
        this.purchasing.markSent(draft, 'automatic', result.sentTo)
        await em.flush()
        sentOrders += 1
        sentLines += draft.lines.length
      } catch (error) {
        if (!(error instanceof OrderMailError)) throw error
        this.logger.error(
          `Automatic send of order ${draft.id} for ${supplier.name} failed: ${error.message}`,
        )
        after.failures.push({ orderId: draft.id, reason: 'mail_error' })
      }
    }

    if (sentOrders > 0) {
      after.summary = {
        distributionDay: due.distributionDay,
        lineCount: sentLines,
        orderCount: sentOrders,
      }
    }
    return {
      supplierId: supplier.id,
      result: after.failures.length > 0 ? 'partly_failed' : 'sent',
      distributionDay: due.distributionDay,
    }
  }

  /** The summary, then each alert. Each notice catches its own errors and never rejects. */
  private async notifyAfterCommit(supplierName: string, after: AfterCommit): Promise<void> {
    if (after.summary) {
      await this.notices.notifyAutoSent({ supplierName, ...after.summary })
    }
    for (const failure of after.failures) {
      await this.notices.notifySendFailed({
        supplierName,
        orderId: failure.orderId,
        mode: 'automatic',
        reason: failure.reason,
      })
    }
    if (after.missedDay) {
      await this.notices.notifyMissedDistribution({
        supplierName,
        distributionDay: after.missedDay,
      })
    }
  }
}

function handledDayOf(supplier: Supplier): string | null {
  const value: unknown = supplier.scheduleHandledDay
  if (!value) return null
  return value instanceof Date ? toParisDay(value) : String(value).slice(0, 10)
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error'
}
