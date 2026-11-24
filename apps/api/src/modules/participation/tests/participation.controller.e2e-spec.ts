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
import { Member } from '../../members/entities/member.entity'
import { createMemberData } from '../../members/members.factory'
import { SlotSignup } from '../entities/slot-signup.entity'
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

  /** A new active member, plus their session. */
  async function makeMember(name: string) {
    const data = await createMemberData(em, {
      user: { name, email: uniqueEmail('shopper') },
      status: 'active',
    })
    return { member: data.member, session: createSessionFromUser(data.user) }
  }

  /** Sign-ups written straight to the database, for the routes that do not exist yet or that must be bypassed. */
  async function insertSignups(slot: Slot, count: number) {
    for (let i = 0; i < count; i++) {
      const { member: other } = await makeMember(`Filler ${i}`)
      const signup = new SlotSignup()
      signup.slot = em.getReference(Slot, slot.id)
      signup.member = em.getReference(Member, other.id)
      em.persist(signup)
    }
    await em.flush()
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
  describe('admin edit, cancel and delete', () => {
    const tomorrow = () => new Date(Date.now() + DAY)
    const inTwoDays = () => new Date(Date.now() + 2 * DAY)

    it('an admin cannot set places below the sign-ups already there (places_below_signups)', async () => {
      const slot = await insertSlot(tomorrow(), inTwoDays(), 3)
      await insertSignups(slot, 2)

      const res = await request.withSession(admin).put(`/admin/slots/${slot.id}`).send({
        roleLabel: slot.roleLabel,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        places: 1,
      })

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('places_below_signups')
    })

    /** The body of an edit that keeps the slot as it is, with some fields replaced. */
    const editBody = (slot: Slot, overrides: Record<string, unknown> = {}) => ({
      roleLabel: slot.roleLabel,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      places: slot.places,
      ...overrides,
    })

    it('changes the label and the places, and allows places equal to the sign-ups', async () => {
      const slot = await insertSlot(tomorrow(), inTwoDays(), 3)
      await insertSignups(slot, 2)

      const res = await request
        .withSession(admin)
        .put(`/admin/slots/${slot.id}`)
        .send(editBody(slot, { roleLabel: 'Close the shop', places: 2 }))

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        roleLabel: 'Close the shop',
        places: 2,
        signedUpCount: 2,
        freePlaces: 0,
      })
    })

    it('refuses a change of date or time while members are signed up (slot_has_signups)', async () => {
      const slot = await insertSlot(tomorrow(), inTwoDays(), 3)
      await insertSignups(slot, 1)

      const res = await request
        .withSession(admin)
        .put(`/admin/slots/${slot.id}`)
        .send(editBody(slot, { endsAt: new Date(slot.endsAt.getTime() + HOUR).toISOString() }))

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('slot_has_signups')
    })

    it('changes the date and times when nobody is signed up', async () => {
      const slot = await insertSlot(tomorrow(), inTwoDays(), 3)
      const newStart = new Date(Date.now() + 4 * DAY)

      const res = await request
        .withSession(admin)
        .put(`/admin/slots/${slot.id}`)
        .send(
          editBody(slot, {
            startsAt: newStart.toISOString(),
            endsAt: new Date(newStart.getTime() + 2 * HOUR).toISOString(),
          }),
        )

      expect(res.status).toBe(200)
      expect(new Date(res.body.startsAt).getTime()).toBe(newStart.getTime())
    })

    it('refuses to edit a slot that has ended (slot_ended)', async () => {
      const slot = await insertSlot(new Date(Date.now() - 2 * DAY), new Date(Date.now() - DAY))

      const res = await request
        .withSession(admin)
        .put(`/admin/slots/${slot.id}`)
        .send(editBody(slot))

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('slot_ended')
    })

    it('404s an edit, a cancel and a delete of an unknown slot', async () => {
      const unknown = '00000000-0000-4000-8000-000000000000'
      const as = request.withSession(admin)

      const responses = await Promise.all([
        as.put(`/admin/slots/${unknown}`).send(slotBody(5)),
        as.post(`/admin/slots/${unknown}/cancel`),
        as.del(`/admin/slots/${unknown}`),
      ])

      expect(responses.map((res) => res.status)).toEqual([404, 404, 404])
    })

    it('cancels a slot, and a second cancel keeps the first time stamp', async () => {
      const slot = await insertSlot(tomorrow(), inTwoDays())

      const first = await request.withSession(admin).post(`/admin/slots/${slot.id}/cancel`)
      const second = await request.withSession(admin).post(`/admin/slots/${slot.id}/cancel`)

      expect(first.status).toBe(200)
      expect(first.body).toMatchObject({ isCancelled: true, freePlaces: 0 })
      expect(first.body.cancelledAt).toBeTruthy()
      expect(second.status).toBe(200)
      expect(second.body.cancelledAt).toBe(first.body.cancelledAt)
    })

    it('refuses to cancel a slot that has ended (slot_ended)', async () => {
      const slot = await insertSlot(new Date(Date.now() - 2 * DAY), new Date(Date.now() - DAY))

      const res = await request.withSession(admin).post(`/admin/slots/${slot.id}/cancel`)

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('slot_ended')
    })

    it('refuses to delete a slot with sign-ups and keeps the slot (slot_has_signups)', async () => {
      const slot = await insertSlot(tomorrow(), inTwoDays())
      await insertSignups(slot, 1)

      const res = await request.withSession(admin).del(`/admin/slots/${slot.id}`)
      const still = await request.withSession(admin).get(`/admin/slots/${slot.id}`)

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('slot_has_signups')
      expect(still.status).toBe(200)
    })

    it('still refuses to delete a cancelled slot that holds sign-ups', async () => {
      const slot = await insertSlot(tomorrow(), inTwoDays())
      await insertSignups(slot, 1)
      await request.withSession(admin).post(`/admin/slots/${slot.id}/cancel`)

      const res = await request.withSession(admin).del(`/admin/slots/${slot.id}`)

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('slot_has_signups')
    })

    it('deletes a slot with no sign-ups', async () => {
      const slot = await insertSlot(tomorrow(), inTwoDays())

      const res = await request.withSession(admin).del(`/admin/slots/${slot.id}`)
      const gone = await request.withSession(admin).get(`/admin/slots/${slot.id}`)

      expect(res.status).toBe(204)
      expect(gone.status).toBe(404)
    })

    it('refuses a member on edit, cancel and delete with 403', async () => {
      const slot = await insertSlot(tomorrow(), inTwoDays())
      const as = request.withSession(member)

      const responses = await Promise.all([
        as.put(`/admin/slots/${slot.id}`).send(editBody(slot)),
        as.post(`/admin/slots/${slot.id}/cancel`),
        as.del(`/admin/slots/${slot.id}`),
      ])

      expect(responses.map((res) => res.status)).toEqual([403, 403, 403])
    })

    describe('the closed doors to the cancelled state', () => {
      it('an edit with a cancelledAt in the body does not cancel the slot', async () => {
        const slot = await insertSlot(tomorrow(), inTwoDays())

        const res = await request
          .withSession(admin)
          .put(`/admin/slots/${slot.id}`)
          .send(editBody(slot, { cancelledAt: new Date().toISOString(), isCancelled: true }))

        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({ isCancelled: false, cancelledAt: null })
        const stored = await em.fork().findOneOrFail(Slot, slot.id)
        expect(stored.cancelledAt ?? null).toBeNull()
      })

      it('the clock passing the end does not cancel the slot', async () => {
        const slot = await insertSlot(new Date(Date.now() - 2 * DAY), new Date(Date.now() - DAY))

        const res = await request.withSession(admin).get(`/admin/slots/${slot.id}`)

        expect(res.body).toMatchObject({ isCancelled: false, cancelledAt: null })
        const stored = await em.fork().findOneOrFail(Slot, slot.id)
        expect(stored.cancelledAt ?? null).toBeNull()
      })
    })
  })
})
