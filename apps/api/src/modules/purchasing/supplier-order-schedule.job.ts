import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { describeError } from '../../common/error.util'
import { config } from '../../config/env.config'
import { SupplierOrderScheduleService } from './supplier-order-schedule.service'

/**
 * Ticks every five minutes and runs the automatic supplier orders: an e-mail leaves at most
 * five minutes after its hour. `waitForCompletion` stops a slow pass from overlapping the
 * next tick in one process; the row lock on the supplier covers two processes. Off under the
 * browser suite (`E2E`), so those tests never send on the wall clock.
 */
@Injectable()
export class SupplierOrderScheduleJob {
  private readonly logger = new Logger(SupplierOrderScheduleJob.name)

  constructor(private readonly scheduleRun: SupplierOrderScheduleService) {}

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'supplier-order-schedule',
    waitForCompletion: true,
    disabled: config.e2e,
  })
  async tick(): Promise<void> {
    try {
      await this.scheduleRun.runDue(new Date())
    } catch (error) {
      this.logger.error(
        `Automatic supplier order run failed: ${describeError(error)}`,
      )
    }
  }
}
