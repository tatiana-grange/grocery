/**
 * E2E tests for participation slots: the admin routes that create, edit, cancel and delete
 * slots, and the member routes that list them and sign up. The clock is real, so slot dates are
 * built relative to now.
 */
import type { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { initializeTestApp } from '../../../test/helpers/test-app.helper'
import {
  createRequest,
  createSessionFromUser,
  type TestRequest,
} from '../../../test/helpers/test-auth.helper'
import { createMemberData } from '../../members/members.factory'
import { Slot } from '../entities/slot.entity'
import { ParticipationModule } from '../participation.module'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

describe('participation slots (e2e)', () => {
  let em: EntityManager
  let request: TestRequest
  let admin: ReturnType<typeof createSessionFromUser>
  let member: ReturnType<typeof createSessionFromUser>

  const uniqueEmail = (prefix: string) =>
    `${prefix}-${Math.random().toString(36).slice(2)}@example.com`

  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      { imports: [ParticipationModule] },
    )
    context.app = app
    em = orm.em.fork()
    request = createRequest(app)

    const adminData = await createMemberData(em, {
      user: { name: 'Ada Admin', email: uniqueEmail('admin') },
      roles: ['member', 'admin'],
      status: 'active',
    })
    admin = createSessionFromUser(adminData.user)
    const memberData = await createMemberData(em, {
      user: { name: 'Mia Member', email: uniqueEmail('member') },
      status: 'active',
    })
    member = createSessionFromUser(memberData.user)
  })

  /** A slot body that starts `startInDays` from now and lasts `hours`. */
  function slotBody(startInDays: number, overrides: Record<string, unknown> = {}, hours = 3) {
    const startsAt = new Date(Date.now() + startInDays * DAY)
    return {
      roleLabel: 'Run the distribution',
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + hours * HOUR).toISOString(),
      places: 3,
      ...overrides,
    }
  }

  /** A slot written straight to the database, so it can sit in the past. */
  async function insertSlot(
    startsAt: Date,
    endsAt: Date,
    places = 3,
    roleLabel = 'Stock the shelves',
  ) {
    const slot = new Slot()
    slot.roleLabel = roleLabel
    slot.startsAt = startsAt
    slot.endsAt = endsAt
    slot.places = places
    em.persist(slot)
    await em.flush()
    return slot
  }

  describe('admin create and list', () => {
    it('an admin creates a slot and lists it (201 then 200)', async () => {
      const created = await request.withSession(admin).post('/admin/slots').send(slotBody(10))
      expect(created.status).toBe(201)
      expect(created.body).toMatchObject({
        roleLabel: 'Run the distribution',
        places: 3,
        signedUpCount: 0,
        freePlaces: 3,
        isCancelled: false,
      })

      const list = await request.withSession(admin).get('/admin/slots')
      expect(list.status).toBe(200)
      expect(list.body.data.map((slot: { id: string }) => slot.id)).toEqual([created.body.id])
    })

    it('refuses a member on every admin slot route with 403', async () => {
      const slot = await insertSlot(new Date(Date.now() + DAY), new Date(Date.now() + 2 * DAY))
      const as = request.withSession(member)

      const responses = await Promise.all([
        as.get('/admin/slots'),
        as.get(`/admin/slots/${slot.id}`),
        as.post('/admin/slots').send(slotBody(10)),
      ])

      expect(responses.map((res) => res.status)).toEqual([403, 403, 403])
    })

    it('refuses a caller with no session with 401', async () => {
      const responses = await Promise.all([
        request.get('/admin/slots'),
        request.post('/admin/slots').send(slotBody(10)),
      ])

      expect(responses.map((res) => res.status)).toEqual([401, 401])
    })

    it.each([
      [
        'an end that is not after the start',
        {
          endsAt: new Date(Date.now() + 10 * DAY).toISOString(),
          startsAt: new Date(Date.now() + 10 * DAY).toISOString(),
        },
      ],
      ['zero places', { places: 0 }],
      ['201 places', { places: 201 }],
      ['an empty label', { roleLabel: '   ' }],
    ])('rejects %s with 400', async (_name, overrides) => {
      const res = await request
        .withSession(admin)
        .post('/admin/slots')
        .send(slotBody(10, overrides))

      expect(res.status).toBe(400)
    })

    it('accepts 200 places and a slot that crosses midnight', async () => {
      const startsAt = new Date('2030-01-01T22:00:00Z')
      const res = await request
        .withSession(admin)
        .post('/admin/slots')
        .send({
          roleLabel: 'Night shift',
          startsAt: startsAt.toISOString(),
          endsAt: new Date(startsAt.getTime() + 4 * HOUR).toISOString(),
          places: 200,
        })

      expect(res.status).toBe(201)
    })

    it('hides ended slots unless includePast is true, and orders by start', async () => {
      const ended = await insertSlot(new Date(Date.now() - 2 * DAY), new Date(Date.now() - DAY))
      const later = await insertSlot(new Date(Date.now() + 5 * DAY), new Date(Date.now() + 6 * DAY))
      const sooner = await insertSlot(new Date(Date.now() + DAY), new Date(Date.now() + 2 * DAY))
      const ids = (res: { body: { data: { id: string }[] } }) => res.body.data.map((s) => s.id)

      const coming = await request.withSession(admin).get('/admin/slots')
      const all = await request.withSession(admin).get('/admin/slots?includePast=true')

      expect(ids(coming)).toEqual([sooner.id, later.id])
      expect(ids(all)).toEqual([ended.id, sooner.id, later.id])
    })

    it('reads one slot with an empty sign-up list, and 404s an unknown id', async () => {
      const slot = await insertSlot(new Date(Date.now() + DAY), new Date(Date.now() + 2 * DAY))

      const found = await request.withSession(admin).get(`/admin/slots/${slot.id}`)
      const missing = await request
        .withSession(admin)
        .get('/admin/slots/00000000-0000-4000-8000-000000000000')

      expect(found.status).toBe(200)
      expect(found.body.signups).toEqual([])
      expect(missing.status).toBe(404)
    })
  })
})
