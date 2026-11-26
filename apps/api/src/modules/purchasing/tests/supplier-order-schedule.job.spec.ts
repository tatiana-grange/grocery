import { Logger } from '@nestjs/common'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupplierOrderScheduleService } from '../supplier-order-schedule.service'
import { SupplierOrderScheduleJob } from '../supplier-order-schedule.job'

describe('SupplierOrderScheduleJob.tick', () => {
  afterEach(() => vi.restoreAllMocks())

  it('calls the run with the current time', async () => {
    const runDue = vi.fn().mockResolvedValue([])
    const job = new SupplierOrderScheduleJob({ runDue } as unknown as SupplierOrderScheduleService)

    await job.tick()

    expect(runDue).toHaveBeenCalledTimes(1)
    expect(runDue.mock.calls[0][0]).toBeInstanceOf(Date)
  })

  it('resolves, and logs, when the run throws', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
    const runDue = vi.fn().mockRejectedValue(new Error('database down'))
    const job = new SupplierOrderScheduleJob({ runDue } as unknown as SupplierOrderScheduleService)

    await expect(job.tick()).resolves.toBeUndefined()
    expect(Logger.prototype.error).toHaveBeenCalled()
  })
})
