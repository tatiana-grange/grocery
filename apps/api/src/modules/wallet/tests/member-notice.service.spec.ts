import type { EntityManager, MikroORM } from '@mikro-orm/core'
import { Logger } from '@nestjs/common'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { cleanupTestOrm, createTestOrm } from '../../../test/helpers/test-db.helper'
import type { EmailService } from '../../email/email.service'
import { createMemberData } from '../../members/members.factory'
import { MemberNoticeService } from '../member-notice.service'

/**
 * `MemberNoticeService` against a real database (it reads the admins and the member) and a
 * fake mail service that records what it was asked to send.
 */
describe('MemberNoticeService.notifyNegativeBalance', () => {
  let orm: MikroORM
  let em: EntityManager
  let sendEmail: ReturnType<typeof vi.fn>
  let service: MemberNoticeService
  let memberId: string

  const unique = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2)}@example.com`

  beforeEach(async () => {
    orm = (await createTestOrm(inject('pgConfig'))).orm
    em = orm.em.fork()
    sendEmail = vi.fn().mockResolvedValue(undefined)
    service = new MemberNoticeService(em, { sendEmail } as unknown as EmailService)
    const member = await createMemberData(em, {
      user: { name: 'Mia Member', email: 'mia@example.com' },
      status: 'active',
    })
    memberId = member.member.id
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

  it('sends one mail to each admin and one to the member', async () => {
    await makeAdmin('ada@example.com')
    await makeAdmin('bob@example.com')

    await service.notifyNegativeBalance(memberId, -500)

    expect(recipients()).toEqual(['ada@example.com', 'bob@example.com', 'mia@example.com'])
  })

  it('tells the member there is a problem, with no amount and no mention of a correction', async () => {
    await service.notifyNegativeBalance(memberId, -1234)

    const [options] = sendEmail.mock.calls.find(([o]) => o.to === 'mia@example.com')!
    expect(options.subject).toBe('Un problème sur votre compte')
    const text = `${options.subject} ${options.content} ${options.html}`
    expect(text).not.toMatch(/12[,.]34/)
    expect(text).not.toMatch(/1234/)
    expect(text).not.toMatch(/correct/i)
    expect(options.content).toContain('Mia Member')
  })

  it('tells each admin who is below zero, with the membership number and the balance', async () => {
    await makeAdmin('ada@example.com')

    await service.notifyNegativeBalance(memberId, -500)

    const [options] = sendEmail.mock.calls.find(([o]) => o.to === 'ada@example.com')!
    expect(options.subject).toBe('Solde négatif : Mia Member')
    expect(options.content).toContain('Mia Member')
    expect(options.content).toMatch(/5,00/)
    expect(options.html).toBeTruthy()
  })

  it('skips a banned admin, a phone-only admin and a user who is not an admin', async () => {
    await makeAdmin('banned@example.com', { banned: true })
    await makeAdmin('33600000000@phone.grocery.local')
    await createMemberData(em, {
      user: { name: 'Dina Distributor', email: 'dina@example.com' },
      roles: ['member', 'distributor'],
      status: 'active',
    })

    await service.notifyNegativeBalance(memberId, -500)

    expect(recipients()).toEqual(['mia@example.com'])
  })

  it('sends nothing to a phone-only member and logs it', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {})
    const phoneOnly = await createMemberData(em, {
      user: { name: 'Paul Phone', email: '33611111111@phone.grocery.local' },
      status: 'active',
    })

    await service.notifyNegativeBalance(phoneOnly.member.id, -500)

    expect(sendEmail).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(expect.stringContaining(phoneOnly.member.id))
  })

  it('lets one failing send leave the others alone, logs it, and does not reject', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
    await makeAdmin('ada@example.com')
    await makeAdmin('bob@example.com')
    sendEmail.mockImplementation(async ({ to }: { to: string }) => {
      if (to === 'ada@example.com') throw new Error('smtp down')
    })

    await expect(service.notifyNegativeBalance(memberId, -500)).resolves.toBeUndefined()

    expect(recipients()).toEqual(['ada@example.com', 'bob@example.com', 'mia@example.com'])
    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(expect.stringContaining(memberId))
    expect(error).toHaveBeenCalledWith(expect.stringContaining('admin'))
  })

  it('does not reject when the member does not exist', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})

    await expect(
      service.notifyNegativeBalance('00000000-0000-4000-8000-000000000000', -500),
    ).resolves.toBeUndefined()

    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('MemberNoticeService.notifyUnderpaidTopup', () => {
  let orm: MikroORM
  let em: EntityManager
  let sendEmail: ReturnType<typeof vi.fn>
  let service: MemberNoticeService
  let memberId: string

  beforeEach(async () => {
    orm = (await createTestOrm(inject('pgConfig'))).orm
    em = orm.em.fork()
    sendEmail = vi.fn().mockResolvedValue(undefined)
    service = new MemberNoticeService(em, { sendEmail } as unknown as EmailService)
    const member = await createMemberData(em, {
      user: { name: 'Mia Member', email: 'mia@example.com' },
      status: 'active',
    })
    memberId = member.member.id
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
  const input = () => ({ memberId, requestedCents: 2000, paidCents: 1500, topupId: 'topup-42' })

  it('notifyUnderpaidTopup sends one mail to each admin and none to the member', async () => {
    await makeAdmin('ada@example.com')
    await makeAdmin('bob@example.com')

    await service.notifyUnderpaidTopup(input())

    expect(recipients()).toEqual(['ada@example.com', 'bob@example.com'])
  })

  it('names the member, both amounts and the top-up, and says nothing was credited', async () => {
    await makeAdmin('ada@example.com')

    await service.notifyUnderpaidTopup(input())

    const [options] = sendEmail.mock.calls[0]!
    expect(options.subject).toBe('Paiement incomplet : Mia Member')
    expect(options.content).toContain('Mia Member')
    expect(options.content).toMatch(/20,00/)
    expect(options.content).toMatch(/15,00/)
    expect(options.content).toContain('topup-42')
    expect(options.content).toMatch(/rien n.a été crédité/i)
    expect(options.html).toBeTruthy()
  })

  it('skips a banned admin, a phone-only admin and a user who is not an admin', async () => {
    await makeAdmin('banned@example.com', { banned: true })
    await makeAdmin('33600000000@phone.grocery.local')
    await createMemberData(em, {
      user: { name: 'Dina Distributor', email: 'dina@example.com' },
      roles: ['member', 'distributor'],
      status: 'active',
    })
    await makeAdmin('ada@example.com')

    await service.notifyUnderpaidTopup(input())

    expect(recipients()).toEqual(['ada@example.com'])
  })

  it('lets one failing send leave the others alone, logs the top-up id, and does not reject', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
    await makeAdmin('ada@example.com')
    await makeAdmin('bob@example.com')
    sendEmail.mockImplementation(async ({ to }: { to: string }) => {
      if (to === 'ada@example.com') throw new Error('smtp down')
    })

    await expect(service.notifyUnderpaidTopup(input())).resolves.toBeUndefined()

    expect(recipients()).toEqual(['ada@example.com', 'bob@example.com'])
    expect(error).toHaveBeenCalledWith(expect.stringContaining('topup-42'))
  })

  it('does not reject when the member does not exist', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
    await makeAdmin('ada@example.com')

    await expect(
      service.notifyUnderpaidTopup({
        ...input(),
        memberId: '00000000-0000-4000-8000-000000000000',
      }),
    ).resolves.toBeUndefined()

    expect(sendEmail).not.toHaveBeenCalled()
  })
})
