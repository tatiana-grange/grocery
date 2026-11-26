import type { EntityManager, MikroORM } from '@mikro-orm/core'
import { Logger } from '@nestjs/common'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { cleanupTestOrm, createTestOrm } from '../../../test/helpers/test-db.helper'
import { createSupplierData } from '../../catalog/catalog.factory'
import type { EmailService } from '../../email/email.service'
import { createMemberData } from '../../members/members.factory'
import { SupplierOrder } from '../entities/supplier-order.entity'
import { SupplierOrderNoticeService } from '../supplier-order-notice.service'

/**
 * The admin e-mails of supplier ordering, against a real database (it reads the admins and the
 * order) and a fake mail service that records what it was asked to send.
 */
describe('SupplierOrderNoticeService', () => {
  let orm: MikroORM
  let em: EntityManager
  let sendEmail: ReturnType<typeof vi.fn>
  let service: SupplierOrderNoticeService
  let orderId: string

  beforeEach(async () => {
    orm = (await createTestOrm(inject('pgConfig'))).orm
    em = orm.em.fork()
    sendEmail = vi.fn().mockResolvedValue(undefined)
    service = new SupplierOrderNoticeService(em, { sendEmail } as unknown as EmailService)

    const supplier = await createSupplierData(em, { name: 'Moulin Dupont' })
    const order = new SupplierOrder()
    order.supplier = supplier
    order.createdAt = new Date('2026-12-02T09:30:00Z')
    await em.persist(order).flush()
    orderId = order.id
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await cleanupTestOrm(orm)
  })

  async function makeAdmin(email: string, extra: { banned?: boolean } = {}) {
    const { user } = await createMemberData(em, {
      user: { name: 'Ada Admin', email },
      roles: ['member', 'admin'],
      status: 'active',
    })
    if (extra.banned) {
      user.banned = true
      await em.flush()
    }
  }

  const recipients = () => sendEmail.mock.calls.map(([options]) => options.to as string).sort()
  const mailTo = (to: string) => sendEmail.mock.calls.find(([options]) => options.to === to)![0]

  it('admin-summary: tells each admin which supplier was sent, for which distribution, how many lines', async () => {
    await makeAdmin('ada@example.com')
    await makeAdmin('bob@example.com')

    await service.notifyAutoSent({
      supplierName: 'Moulin Dupont',
      distributionDay: '2026-12-04',
      lineCount: 7,
      orderCount: 2,
    })

    expect(recipients()).toEqual(['ada@example.com', 'bob@example.com'])
    const options = mailTo('ada@example.com')
    expect(options.subject).toBe('Commande envoyée automatiquement : Moulin Dupont')
    expect(options.content).toContain('Moulin Dupont')
    expect(options.content).toContain('4 décembre 2026')
    expect(options.content).toContain('7 lignes')
    expect(options.content).toContain('2 commandes')
    expect(options.html).toContain('Moulin Dupont')
  })

  it('auto-failure-alert: names the supplier, the order and the reason, for each admin, once', async () => {
    await makeAdmin('ada@example.com')
    await makeAdmin('bob@example.com')

    await service.notifySendFailed({
      supplierName: 'Moulin Dupont',
      orderId,
      mode: 'automatic',
      reason: 'no_address',
    })

    expect(recipients()).toEqual(['ada@example.com', 'bob@example.com'])
    const options = mailTo('bob@example.com')
    expect(options.subject).toBe('Commande non envoyée : Moulin Dupont')
    expect(options.content).toContain('Moulin Dupont')
    expect(options.content).toContain(orderId)
    expect(options.content).toContain('2 décembre 2026')
    expect(options.content).toContain(`/admin/purchasing/supplier-orders/${orderId}`)
    expect(options.content).toContain("pas d'adresse e-mail")
    expect(options.content).toContain('automatique')
    expect(options.content).toContain('brouillon')
  })

  it('manual-failure-alert: a mail error on a manual send says the mail server refused it', async () => {
    await makeAdmin('ada@example.com')

    await service.notifySendFailed({
      supplierName: 'Moulin Dupont',
      orderId,
      mode: 'manual',
      reason: 'mail_error',
    })

    const options = mailTo('ada@example.com')
    expect(options.content).toContain('serveur')
    expect(options.content).toContain('à la main')
    expect(options.content).not.toContain("pas d'adresse e-mail")
  })

  it('auto-late-catch-up: tells each admin a distribution started with no order sent', async () => {
    await makeAdmin('ada@example.com')

    await service.notifyMissedDistribution({
      supplierName: 'Moulin Dupont',
      distributionDay: '2026-12-04',
    })

    const options = mailTo('ada@example.com')
    expect(options.subject).toBe('Distribution sans commande envoyée : Moulin Dupont')
    expect(options.content).toContain('Moulin Dupont')
    expect(options.content).toContain('4 décembre 2026')
  })

  it('skips a banned admin, a phone-only admin and a user who is not an admin', async () => {
    await makeAdmin('ada@example.com')
    await makeAdmin('banned@example.com', { banned: true })
    await makeAdmin('33600000000@phone.grocery.local')
    await createMemberData(em, {
      user: { name: 'Dina Distributor', email: 'dina@example.com' },
      roles: ['member', 'distributor'],
      status: 'active',
    })

    await service.notifyMissedDistribution({
      supplierName: 'Moulin Dupont',
      distributionDay: '2026-12-04',
    })

    expect(recipients()).toEqual(['ada@example.com'])
  })

  it('lets one failing send leave the others alone, logs it with the supplier and the order, and does not reject', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
    await makeAdmin('ada@example.com')
    await makeAdmin('bob@example.com')
    sendEmail.mockImplementation(async ({ to }: { to: string }) => {
      if (to === 'ada@example.com') throw new Error('smtp down')
    })

    await expect(
      service.notifySendFailed({
        supplierName: 'Moulin Dupont',
        orderId,
        mode: 'automatic',
        reason: 'mail_error',
      }),
    ).resolves.toBeUndefined()

    expect(recipients()).toEqual(['ada@example.com', 'bob@example.com'])
    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Moulin Dupont'))
    expect(error).toHaveBeenCalledWith(expect.stringContaining(orderId))
  })

  it('does not reject when the database fails, and logs it', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
    vi.spyOn(em, 'find').mockRejectedValue(new Error('db down'))

    await expect(
      service.notifyAutoSent({
        supplierName: 'Moulin Dupont',
        distributionDay: '2026-12-04',
        lineCount: 1,
        orderCount: 1,
      }),
    ).resolves.toBeUndefined()

    expect(sendEmail).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Moulin Dupont'))
  })

  it('sends nothing, and does not reject, when no admin has a real address', async () => {
    await expect(
      service.notifyMissedDistribution({
        supplierName: 'Moulin Dupont',
        distributionDay: '2026-12-04',
      }),
    ).resolves.toBeUndefined()

    expect(sendEmail).not.toHaveBeenCalled()
  })
})
