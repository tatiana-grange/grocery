import type { EntityManager, MikroORM } from '@mikro-orm/core'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { cleanupTestOrm, createTestOrm } from '../../../test/helpers/test-db.helper'
import {
  createProductData,
  createReferentData,
  createSupplierData,
} from '../../catalog/catalog.factory'
import { Product } from '../../catalog/entities/product.entity'
import { Supplier } from '../../catalog/entities/supplier.entity'
import type { EmailService } from '../../email/email.service'
import type { InventoryService } from '../../inventory/inventory.service'
import { createMemberData } from '../../members/members.factory'
import { Member } from '../../members/entities/member.entity'
import { OrderLine } from '../../orders/entities/order-line.entity'
import { Order } from '../../orders/entities/order.entity'
import { SupplierOrder } from '../entities/supplier-order.entity'
import { SupplierOrderLine } from '../entities/supplier-order-line.entity'
import { PurchasingMapper } from '../purchasing.mapper'
import { PurchasingService } from '../purchasing.service'
import { SupplierOrderMailService } from '../supplier-order-mail.service'
import { SupplierOrderNoticeService } from '../supplier-order-notice.service'
import { SupplierOrderScheduleService } from '../supplier-order-schedule.service'

/**
 * The automatic run, called with instants (never waiting on a clock), against a real database
 * and a fake mail service. The supplier is the flour example of the spec: distribution the
 * first Friday of the month, sent the last Wednesday before at 8:00 Paris. The next
 * distribution from the end of November 2026 is Friday 4 December, sent Wednesday 2 December
 * at 8:00 (07:00 UTC in winter).
 */
describe('SupplierOrderScheduleService.runDue', () => {
  const SUPPLIER_ADDRESS = 'commandes@moulin.example'
  const BEFORE = new Date('2026-12-02T06:59:00Z')
  const AT = new Date('2026-12-02T07:00:00Z')
  const LATE = new Date('2026-12-03T10:00:00Z')
  const STARTED = new Date('2026-12-04T10:00:00Z')

  let orm: MikroORM
  let em: EntityManager
  let sendEmail: ReturnType<typeof vi.fn>
  let service: SupplierOrderScheduleService
  let supplier: Supplier
  let product: Product

  function buildService(forkEm: EntityManager) {
    const email = { sendEmail } as unknown as EmailService
    const purchasing = new PurchasingService(
      forkEm,
      {} as InventoryService,
      new SupplierOrderMailService(email, new PurchasingMapper()),
      new SupplierOrderNoticeService(forkEm, email),
    )
    return new SupplierOrderScheduleService(
      forkEm,
      purchasing,
      new SupplierOrderMailService(email, new PurchasingMapper()),
      new SupplierOrderNoticeService(forkEm, email),
    )
  }

  beforeEach(async () => {
    orm = (await createTestOrm(inject('pgConfig'))).orm
    em = orm.em.fork()
    sendEmail = vi.fn().mockResolvedValue(undefined)
    service = buildService(orm.em.fork())

    supplier = await createSupplierData(em, { name: 'Moulin Dupont' })
    supplier.contactEmail = SUPPLIER_ADDRESS
    supplier.scheduleEnabled = true
    supplier.scheduleFrequency = 'monthly'
    supplier.scheduleMonthWeek = 'first'
    supplier.scheduleDistributionWeekday = 5
    supplier.scheduleSendingWeekday = 3
    supplier.scheduleSendingHour = 8
    supplier.scheduleActiveSince = new Date('2026-11-10T00:00:00Z')
    await em.flush()
    ;({ product } = await createProductData(em, {
      name: 'Farine T65',
      supplier,
      orderingMode: 'pre_order',
    }))
    await createMemberData(em, {
      user: { name: 'Ada Admin', email: 'ada@example.com' },
      roles: ['member', 'admin'],
      status: 'active',
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await cleanupTestOrm(orm)
  })

  const mails = () => sendEmail.mock.calls.map(([options]) => options)
  const supplierMails = () => mails().filter((options) => options.to === SUPPLIER_ADDRESS)
  const adminMails = (subjectStart: string) =>
    mails().filter(
      (options) => options.to === 'ada@example.com' && options.subject.startsWith(subjectStart),
    )
  const reload = <T extends object>(entity: new () => T, where: object) =>
    orm.em.fork().findOneOrFail(entity, where as never)
  const orders = () => orm.em.fork().find(SupplierOrder, { supplier: supplier.id })

  async function preOrder(target: Product, quantity: number) {
    const { member } = await createMemberData(em, {
      user: { email: `m-${Math.random().toString(36).slice(2)}@example.com` },
      status: 'active',
    })
    const order = new Order()
    order.member = member as Member
    order.orderingMode = 'pre_order'
    order.status = 'pending'
    order.totalAmountCents = 0
    order.placedAt = new Date()
    const line = new OrderLine()
    line.order = order
    line.product = target
    line.productNameSnapshot = target.name
    line.quantity = String(quantity)
    line.unitPriceAmountCents = 100
    line.lineTotalAmountCents = 100 * quantity
    order.lines.add(line)
    await em.persist([order, line]).flush()
  }

  async function seedOrder(
    status: 'draft' | 'sent',
    options: { sentAt?: Date; sentMode?: 'manual' | 'automatic'; createdAt?: Date } = {},
  ) {
    const other = await createProductData(em, {
      name: `Autre ${Math.random().toString(36).slice(2, 6)}`,
      supplier,
      orderingMode: 'pre_order',
    })
    const order = new SupplierOrder()
    order.supplier = supplier
    order.status = status
    if (options.sentAt) order.sentAt = options.sentAt
    if (options.sentMode) order.sentMode = options.sentMode
    if (options.createdAt) order.createdAt = options.createdAt
    const line = new SupplierOrderLine()
    line.supplierOrder = order
    line.product = other.product
    line.quantity = '4'
    await em.persist([order, line]).flush()
    return order
  }

  async function setHandled(day: string) {
    supplier.scheduleHandledDay = day
    await em.flush()
  }

  it('does nothing before the sending moment', async () => {
    await preOrder(product, 2)

    const outcomes = await service.runDue(BEFORE)

    expect(outcomes).toEqual([{ supplierId: supplier.id, result: 'not_due' }])
    expect(sendEmail).not.toHaveBeenCalled()
    expect(await orders()).toHaveLength(0)
  })

  it('auto-send: at the moment it gathers the pending pre-orders, mails the order, marks it automatic, and tells the admins', async () => {
    await preOrder(product, 2)
    await preOrder(product, 3)

    const outcomes = await service.runDue(AT)

    expect(outcomes).toEqual([
      { supplierId: supplier.id, result: 'sent', distributionDay: '2026-12-04' },
    ])
    expect(supplierMails()).toHaveLength(1)
    expect(supplierMails()[0].attachments).toHaveLength(1)
    const [order] = await orders()
    expect(order.status).toBe('sent')
    expect(order.sentMode).toBe('automatic')
    expect(order.sentTo).toBe(SUPPLIER_ADDRESS)
    expect((await reload(Supplier, { id: supplier.id })).scheduleHandledDay).toBe('2026-12-04')
    const summary = adminMails('Commande envoyée automatiquement')
    expect(summary).toHaveLength(1)
    expect(summary[0].content).toContain('Moulin Dupont')
    expect(summary[0].content).toContain('4 décembre 2026')
    expect(summary[0].content).toContain('1 ligne')
  })

  it('a second pass handles nothing more', async () => {
    await preOrder(product, 2)
    await service.runDue(AT)
    sendEmail.mockClear()
    await preOrder(product, 1)

    const outcomes = await service.runDue(new Date('2026-12-02T08:00:00Z'))

    expect(outcomes[0].result).toBe('not_due')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('auto-skips-when-done: an order sent by hand since the previous distribution day stops the run', async () => {
    await preOrder(product, 2)
    // The previous distribution day is Friday 6 November 2026.
    await seedOrder('sent', { sentAt: new Date('2026-11-10T10:00:00Z'), sentMode: 'manual' })

    const outcomes = await service.runDue(AT)

    expect(outcomes[0].result).toBe('already_sent')
    expect(sendEmail).not.toHaveBeenCalled()
    expect((await reload(Supplier, { id: supplier.id })).scheduleHandledDay).toBe('2026-12-04')
  })

  it('auto-skips-when-done: the automatic send of the previous distribution does not block this one', async () => {
    await setHandled('2026-11-06')
    // Sent automatically on Wednesday 4 November, a few minutes after its 8:00 moment.
    await seedOrder('sent', { sentAt: new Date('2026-11-04T07:05:00Z'), sentMode: 'automatic' })
    await preOrder(product, 2)

    const outcomes = await service.runDue(AT)

    expect(outcomes[0].result).toBe('sent')
    expect(supplierMails()).toHaveLength(1)
  })

  it('a send made on the previous distribution day itself counts for this distribution', async () => {
    await setHandled('2026-11-06')
    await seedOrder('sent', { sentAt: new Date('2026-11-05T23:00:00Z'), sentMode: 'manual' })
    await preOrder(product, 2)

    const outcomes = await service.runDue(AT)

    expect(outcomes[0].result).toBe('already_sent')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('auto-sends-existing-draft: an older draft and the new pre-orders leave as two e-mails', async () => {
    const older = await seedOrder('draft', { createdAt: new Date('2026-11-20T10:00:00Z') })
    await preOrder(product, 2)

    const outcomes = await service.runDue(AT)

    expect(outcomes[0].result).toBe('sent')
    expect(supplierMails()).toHaveLength(2)
    const sent = await orders()
    expect(sent).toHaveLength(2)
    expect(sent.every((order) => order.status === 'sent' && order.sentMode === 'automatic')).toBe(
      true,
    )
    expect(sent.some((order) => order.id === older.id)).toBe(true)
    const summary = adminMails('Commande envoyée automatiquement')
    expect(summary).toHaveLength(1)
    expect(summary[0].content).toContain('2 commandes')
  })

  it('auto-nothing-to-order: no pre-order and no draft sends nothing', async () => {
    const outcomes = await service.runDue(AT)

    expect(outcomes[0].result).toBe('nothing_to_order')
    expect(sendEmail).not.toHaveBeenCalled()
    expect(await orders()).toHaveLength(0)
    expect((await reload(Supplier, { id: supplier.id })).scheduleHandledDay).toBe('2026-12-04')
  })

  it('auto-late-catch-up: when the API was down at the moment, the run happens before the distribution starts', async () => {
    await preOrder(product, 2)

    const outcomes = await service.runDue(LATE)

    expect(outcomes[0].result).toBe('sent')
    expect(supplierMails()).toHaveLength(1)
  })

  it('after the distribution started: nothing is sent, one missed alert, and no second alert later', async () => {
    await preOrder(product, 2)

    const first = await service.runDue(STARTED)
    const second = await service.runDue(new Date('2026-12-04T11:00:00Z'))

    expect(first[0]).toMatchObject({ result: 'missed', distributionDay: '2026-12-04' })
    expect(second[0].result).toBe('not_due')
    expect(supplierMails()).toHaveLength(0)
    expect(adminMails('Distribution sans commande envoyée')).toHaveLength(1)
    expect(await orders()).toHaveLength(0)
  })

  it('a supplier with no address: the order stays a draft, the admins get an alert, nothing is retried', async () => {
    supplier.contactEmail = undefined
    await em.flush()
    await preOrder(product, 2)

    const first = await service.runDue(AT)
    const second = await service.runDue(LATE)

    expect(first[0].result).toBe('partly_failed')
    expect(second[0].result).toBe('not_due')
    const [order] = await orders()
    expect(order.status).toBe('draft')
    const alerts = adminMails('Commande non envoyée')
    expect(alerts).toHaveLength(1)
    expect(alerts[0].content).toContain("pas d'adresse e-mail")
    expect(adminMails('Commande envoyée automatiquement')).toHaveLength(0)
  })

  it('auto-failure-alert: a mail error leaves a draft, alerts the admins, and a later pass does not retry', async () => {
    sendEmail.mockImplementation(async (options: { to: string }) => {
      if (options.to === SUPPLIER_ADDRESS) throw new Error('Failed to send email: refused')
    })
    await preOrder(product, 2)

    const first = await service.runDue(AT)
    const second = await service.runDue(LATE)

    expect(first[0].result).toBe('partly_failed')
    expect(second[0].result).toBe('not_due')
    expect(supplierMails()).toHaveLength(1)
    const [order] = await orders()
    expect(order.status).toBe('draft')
    expect(adminMails('Commande non envoyée')).toHaveLength(1)
  })

  it('one order failing does not stop the next: the sent one is counted in the summary', async () => {
    const older = await seedOrder('draft', { createdAt: new Date('2026-11-20T10:00:00Z') })
    sendEmail.mockImplementationOnce(async () => {
      throw new Error('Failed to send email: refused')
    })
    await preOrder(product, 2)

    const outcomes = await service.runDue(AT)

    expect(outcomes[0].result).toBe('partly_failed')
    const states = Object.fromEntries((await orders()).map((order) => [order.id, order.status]))
    expect(states[older.id]).toBe('draft')
    expect(Object.values(states).filter((status) => status === 'sent')).toHaveLength(1)
    expect(adminMails('Commande envoyée automatiquement')).toHaveLength(1)
    expect(adminMails('Commande non envoyée')).toHaveLength(1)
  })

  it('skips an archived supplier', async () => {
    supplier.archivedAt = new Date()
    await em.flush()
    await preOrder(product, 2)

    const outcomes = await service.runDue(AT)

    expect(outcomes).toEqual([])
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('a schedule switched on after the moment does nothing for that distribution', async () => {
    supplier.scheduleActiveSince = new Date('2026-12-02T09:00:00Z')
    await em.flush()
    await preOrder(product, 2)

    const first = await service.runDue(new Date('2026-12-02T10:00:00Z'))
    const afterStart = await service.runDue(STARTED)

    expect(first[0].result).toBe('not_due')
    expect(afterStart[0].result).toBe('not_due')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('copies the referent on the automatic e-mail', async () => {
    const referent = await createReferentData(em, { lastName: 'Grolleau' })
    referent.contactEmail = 'referent@moulin.example'
    supplier.referent = referent
    await em.flush()
    await preOrder(product, 2)

    await service.runDue(AT)

    expect(supplierMails()[0].cc).toEqual(['referent@moulin.example'])
  })

  it('auto-once-per-distribution: two runs at once on two forks send one e-mail', async () => {
    await preOrder(product, 2)
    const other = buildService(orm.em.fork())

    const results = await Promise.all([service.runDue(AT), other.runDue(AT)])

    expect(supplierMails()).toHaveLength(1)
    const outcomes = results.flat().map((outcome) => outcome.result)
    expect(outcomes.filter((result) => result === 'sent')).toHaveLength(1)
    expect(await orders()).toHaveLength(1)
  })
})
