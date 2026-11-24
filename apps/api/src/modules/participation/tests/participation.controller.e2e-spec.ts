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
import { createUserData } from '../../auth/auth.factory'
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

  /** The member row behind a session, for ids. */
  async function memberRowOf(session: ReturnType<typeof createSessionFromUser>) {
    if (!session) throw new Error('A session is needed')
    return em.fork().findOneOrFail(Member, { user: session.user.id })
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

    it('refuses to edit a cancelled slot and leaves it unchanged (slot_cancelled)', async () => {
      const slot = await insertSlot(tomorrow(), inTwoDays(), 3)
      await request.withSession(admin).post(`/admin/slots/${slot.id}/cancel`)

      const res = await request
        .withSession(admin)
        .put(`/admin/slots/${slot.id}`)
        .send(editBody(slot, { roleLabel: 'Renamed', places: 5 }))
      const still = await request.withSession(admin).get(`/admin/slots/${slot.id}`)

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('slot_cancelled')
      expect(still.body).toMatchObject({ roleLabel: 'Stock the shelves', places: 3 })
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
  describe('member list and sign-up', () => {
    const inDays = (days: number) => new Date(Date.now() + days * DAY)
    const idsOf = (res: { body: { data: { id: string }[] } }) => res.body.data.map((s) => s.id)

    it('a member signs up for a slot with places left and sees it as taken by them', async () => {
      const slot = await insertSlot(inDays(10), inDays(11), 3)

      const res = await request.withSession(member).post(`/me/slots/${slot.id}/signup`)
      const list = await request.withSession(member).get('/me/slots')

      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ id: slot.id, isSignedUp: true, signedUpCount: 1 })
      expect(list.body.data).toHaveLength(1)
      expect(list.body.data[0]).toMatchObject({ id: slot.id, isSignedUp: true, freePlaces: 2 })
    })

    it('shows a slot as not taken by the caller when someone else is on it', async () => {
      const slot = await insertSlot(inDays(10), inDays(11), 3)
      await insertSignups(slot, 1)

      const list = await request.withSession(member).get('/me/slots')

      expect(list.body.data[0]).toMatchObject({
        isSignedUp: false,
        signedUpCount: 1,
        freePlaces: 2,
      })
    })

    it('refuses a sign-up on a full slot (slot_full)', async () => {
      const slot = await insertSlot(inDays(10), inDays(11), 1)
      await insertSignups(slot, 1)

      const res = await request.withSession(member).post(`/me/slots/${slot.id}/signup`)

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('slot_full')
    })

    it('refuses a sign-up on a slot that has started (slot_started)', async () => {
      const slot = await insertSlot(new Date(Date.now() - HOUR), inDays(1))

      const res = await request.withSession(member).post(`/me/slots/${slot.id}/signup`)

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('slot_started')
    })

    it('refuses a sign-up on a slot that has ended (slot_ended)', async () => {
      const slot = await insertSlot(new Date(Date.now() - 2 * DAY), new Date(Date.now() - DAY))

      const res = await request.withSession(member).post(`/me/slots/${slot.id}/signup`)

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('slot_ended')
    })

    it('refuses a sign-up on a cancelled slot (slot_cancelled)', async () => {
      const slot = await insertSlot(inDays(10), inDays(11))
      await request.withSession(admin).post(`/admin/slots/${slot.id}/cancel`)

      const res = await request.withSession(member).post(`/me/slots/${slot.id}/signup`)

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('slot_cancelled')
    })

    it('refuses a second sign-up by the same member (already_signed_up) and keeps one row', async () => {
      const slot = await insertSlot(inDays(10), inDays(11))
      await request.withSession(member).post(`/me/slots/${slot.id}/signup`)

      const again = await request.withSession(member).post(`/me/slots/${slot.id}/signup`)

      expect(again.status).toBe(409)
      expect(again.body.code).toBe('already_signed_up')
      expect(await em.fork().count(SlotSignup, { slot: slot.id })).toBe(1)
    })

    it('tells a member already on a full slot already_signed_up, not slot_full', async () => {
      const slot = await insertSlot(inDays(10), inDays(11), 1)
      await request.withSession(member).post(`/me/slots/${slot.id}/signup`)

      const again = await request.withSession(member).post(`/me/slots/${slot.id}/signup`)

      expect(again.body.code).toBe('already_signed_up')
    })

    it('404s a sign-up on an unknown slot', async () => {
      const res = await request
        .withSession(member)
        .post('/me/slots/00000000-0000-4000-8000-000000000000/signup')

      expect(res.status).toBe(404)
    })

    it('hides started, ended and cancelled slots from the member list and orders by start', async () => {
      const later = await insertSlot(inDays(6), inDays(7))
      const sooner = await insertSlot(inDays(2), inDays(3))
      await insertSlot(new Date(Date.now() - HOUR), inDays(1))
      await insertSlot(new Date(Date.now() - 2 * DAY), new Date(Date.now() - DAY))
      const cancelled = await insertSlot(inDays(4), inDays(5))
      await request.withSession(admin).post(`/admin/slots/${cancelled.id}/cancel`)

      const list = await request.withSession(member).get('/me/slots')

      expect(idsOf(list)).toEqual([sooner.id, later.id])
    })

    it('answers 404 to an admin who has no member row on the member routes', async () => {
      const lonely = createSessionFromUser(
        await createUserData(em, { emailVerified: true, role: 'admin' }),
      )
      const slot = await insertSlot(inDays(10), inDays(11))

      const responses = await Promise.all([
        request.withSession(lonely).get('/me/slots'),
        request.withSession(lonely).post(`/me/slots/${slot.id}/signup`),
      ])

      expect(responses.map((res) => res.status)).toEqual([404, 404])
    })

    it('answers 403 to a pending member', async () => {
      const pending = await createMemberData(em, {
        user: { name: 'Pat Pending', email: uniqueEmail('pending') },
        status: 'pending',
      })
      const slot = await insertSlot(inDays(10), inDays(11))

      const responses = await Promise.all([
        request.withSession(createSessionFromUser(pending.user)).get('/me/slots'),
        request
          .withSession(createSessionFromUser(pending.user))
          .post(`/me/slots/${slot.id}/signup`),
      ])

      expect(responses.map((res) => res.status)).toEqual([403, 403])
    })

    it('lets a distributor who is also a member sign up like any member', async () => {
      const both = await createMemberData(em, {
        user: { name: 'Dina Both', email: uniqueEmail('both') },
        roles: ['member', 'distributor'],
        status: 'active',
      })
      const slot = await insertSlot(inDays(10), inDays(11))

      const res = await request
        .withSession(createSessionFromUser(both.user))
        .post(`/me/slots/${slot.id}/signup`)

      expect(res.status).toBe(201)
    })

    it('refuses a caller with no session with 401', async () => {
      const res = await request.get('/me/slots')

      expect(res.status).toBe(401)
    })
  })
  describe('leaving, the admin acting on a member, and my sign-ups', () => {
    const inDays = (days: number) => new Date(Date.now() + days * DAY)

    it('a member cannot leave less than 7 days before the start and the answer says too_late_to_leave', async () => {
      const slot = await insertSlot(inDays(3), inDays(4))
      await request.withSession(member).post(`/me/slots/${slot.id}/signup`)

      const res = await request.withSession(member).del(`/me/slots/${slot.id}/signup`)

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('too_late_to_leave')
      expect(await em.fork().count(SlotSignup, { slot: slot.id })).toBe(1)
    })

    it('lets a member leave 7 days or more before the start and frees the place', async () => {
      const slot = await insertSlot(inDays(8), inDays(9), 1)
      await request.withSession(member).post(`/me/slots/${slot.id}/signup`)

      const res = await request.withSession(member).del(`/me/slots/${slot.id}/signup`)

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ isSignedUp: false, signedUpCount: 0, freePlaces: 1 })
      expect(await em.fork().count(SlotSignup, { slot: slot.id })).toBe(0)
    })

    it('does not let a member leave for someone else: the route takes no member id', async () => {
      const slot = await insertSlot(inDays(10), inDays(11))
      await insertSignups(slot, 1)

      const res = await request.withSession(member).del(`/me/slots/${slot.id}/signup`)

      expect(res.status).toBe(404)
      expect(await em.fork().count(SlotSignup, { slot: slot.id })).toBe(1)
    })

    it('answers 404 to a leave on an unknown slot', async () => {
      const res = await request
        .withSession(member)
        .del('/me/slots/00000000-0000-4000-8000-000000000000/signup')

      expect(res.status).toBe(404)
    })

    it('lets a member leave a cancelled slot inside the 7 days', async () => {
      const slot = await insertSlot(inDays(2), inDays(3))
      await request.withSession(member).post(`/me/slots/${slot.id}/signup`)
      await request.withSession(admin).post(`/admin/slots/${slot.id}/cancel`)

      const res = await request.withSession(member).del(`/me/slots/${slot.id}/signup`)

      expect(res.status).toBe(200)
      expect(await em.fork().count(SlotSignup, { slot: slot.id })).toBe(0)
    })

    it('refuses a leave on a slot that has ended (slot_ended)', async () => {
      const slot = await insertSlot(inDays(-2), inDays(-1))
      await insertSignups(slot, 1)
      const mine = new SlotSignup()
      mine.slot = em.getReference(Slot, slot.id)
      mine.member = em.getReference(Member, (await memberRowOf(member)).id)
      em.persist(mine)
      await em.flush()

      const res = await request.withSession(member).del(`/me/slots/${slot.id}/signup`)

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('slot_ended')
    })

    describe('the closed doors to the cancelled state', () => {
      it('a member leaving does not cancel the slot', async () => {
        const slot = await insertSlot(inDays(10), inDays(11))
        await request.withSession(member).post(`/me/slots/${slot.id}/signup`)

        await request.withSession(member).del(`/me/slots/${slot.id}/signup`)

        const stored = await em.fork().findOneOrFail(Slot, slot.id)
        expect(stored.cancelledAt ?? null).toBeNull()
      })

      it('removing the last sign-up does not cancel the slot', async () => {
        const slot = await insertSlot(inDays(10), inDays(11))
        await request.withSession(member).post(`/me/slots/${slot.id}/signup`)
        const memberId = (await memberRowOf(member)).id

        const res = await request
          .withSession(admin)
          .del(`/admin/slots/${slot.id}/signups/${memberId}`)

        expect(res.status).toBe(200)
        const stored = await em.fork().findOneOrFail(Slot, slot.id)
        expect(stored.cancelledAt ?? null).toBeNull()
      })
    })

    describe('admin acts on a member', () => {
      it('removes a member on a slot starting tomorrow, where the member could not leave', async () => {
        const slot = await insertSlot(inDays(1), inDays(2))
        await request.withSession(member).post(`/me/slots/${slot.id}/signup`)
        const memberId = (await memberRowOf(member)).id

        const res = await request
          .withSession(admin)
          .del(`/admin/slots/${slot.id}/signups/${memberId}`)

        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({ id: slot.id, signedUpCount: 0, signups: [] })
      })

      it('answers 404 when the member is not signed up on the slot', async () => {
        const slot = await insertSlot(inDays(1), inDays(2))
        const memberId = (await memberRowOf(member)).id

        const res = await request
          .withSession(admin)
          .del(`/admin/slots/${slot.id}/signups/${memberId}`)

        expect(res.status).toBe(404)
      })

      it('signs a member up on a slot that has already started', async () => {
        const slot = await insertSlot(new Date(Date.now() - HOUR), inDays(1))
        const memberId = (await memberRowOf(member)).id

        const res = await request
          .withSession(admin)
          .post(`/admin/slots/${slot.id}/signups`)
          .send({ memberId })

        expect(res.status).toBe(201)
        expect(res.body.signups.map((s: { memberId: string }) => s.memberId)).toEqual([memberId])
        expect(res.body.signups[0]).toMatchObject({ memberName: 'Mia Member' })
      })

      it('refuses to sign a member up on a full slot (slot_full)', async () => {
        const slot = await insertSlot(inDays(5), inDays(6), 1)
        await insertSignups(slot, 1)
        const memberId = (await memberRowOf(member)).id

        const res = await request
          .withSession(admin)
          .post(`/admin/slots/${slot.id}/signups`)
          .send({ memberId })

        expect(res.status).toBe(409)
        expect(res.body.code).toBe('slot_full')
      })

      it('refuses a sign-up and a removal on an ended slot (slot_ended)', async () => {
        const slot = await insertSlot(inDays(-2), inDays(-1))
        const memberId = (await memberRowOf(member)).id
        const mine = new SlotSignup()
        mine.slot = em.getReference(Slot, slot.id)
        mine.member = em.getReference(Member, memberId)
        em.persist(mine)
        await em.flush()
        const other = await makeMember('Otto Other')

        const signUp = await request
          .withSession(admin)
          .post(`/admin/slots/${slot.id}/signups`)
          .send({ memberId: other.member.id })
        const remove = await request
          .withSession(admin)
          .del(`/admin/slots/${slot.id}/signups/${memberId}`)

        expect([signUp.status, signUp.body.code]).toEqual([409, 'slot_ended'])
        expect([remove.status, remove.body.code]).toEqual([409, 'slot_ended'])
      })

      it('answers 404 to a sign-up for an unknown member', async () => {
        const slot = await insertSlot(inDays(5), inDays(6))

        const res = await request
          .withSession(admin)
          .post(`/admin/slots/${slot.id}/signups`)
          .send({ memberId: '00000000-0000-4000-8000-000000000000' })

        expect(res.status).toBe(404)
      })

      it('respects the overlap rule and the one-sign-up rule', async () => {
        const first = await insertSlot(inDays(5), new Date(inDays(5).getTime() + 4 * HOUR))
        const overlapping = await insertSlot(
          new Date(inDays(5).getTime() + HOUR),
          new Date(inDays(5).getTime() + 5 * HOUR),
        )
        const memberId = (await memberRowOf(member)).id
        const signUp = (slotId: string) =>
          request.withSession(admin).post(`/admin/slots/${slotId}/signups`).send({ memberId })
        await signUp(first.id)

        const again = await signUp(first.id)
        const overlap = await signUp(overlapping.id)

        expect(again.body.code).toBe('already_signed_up')
        expect(overlap.body.code).toBe('overlaps_another_slot')
      })

      it('refuses a member on the admin sign-up and removal routes with 403', async () => {
        const slot = await insertSlot(inDays(5), inDays(6))
        const memberId = (await memberRowOf(member)).id
        const as = request.withSession(member)

        const responses = await Promise.all([
          as.post(`/admin/slots/${slot.id}/signups`).send({ memberId }),
          as.del(`/admin/slots/${slot.id}/signups/${memberId}`),
        ])

        expect(responses.map((res) => res.status)).toEqual([403, 403])
      })
    })

    describe('GET /me/signups', () => {
      it('lists only my coming sign-ups, earliest first, with the leave rule worked out', async () => {
        const later = await insertSlot(inDays(10), inDays(11), 3, 'Later role')
        const sooner = await insertSlot(inDays(3), inDays(4), 3, 'Sooner role')
        const ended = await insertSlot(inDays(-2), inDays(-1))
        const notMine = await insertSlot(inDays(6), inDays(7))
        await insertSignups(notMine, 1)
        await request.withSession(member).post(`/me/slots/${later.id}/signup`)
        await request.withSession(member).post(`/me/slots/${sooner.id}/signup`)
        const mineEnded = new SlotSignup()
        mineEnded.slot = em.getReference(Slot, ended.id)
        mineEnded.member = em.getReference(Member, (await memberRowOf(member)).id)
        em.persist(mineEnded)
        await em.flush()

        const res = await request.withSession(member).get('/me/signups')

        expect(res.status).toBe(200)
        expect(res.body.data.map((s: { slotId: string }) => s.slotId)).toEqual([
          sooner.id,
          later.id,
        ])
        expect(res.body.data[0]).toMatchObject({ roleLabel: 'Sooner role', canLeave: false })
        expect(res.body.data[1]).toMatchObject({ roleLabel: 'Later role', canLeave: true })
        expect(new Date(res.body.data[1].leaveDeadline).getTime()).toBe(
          later.startsAt.getTime() - 7 * DAY,
        )
      })

      it('includes a cancelled slot, marked cancelled, that can still be left', async () => {
        const slot = await insertSlot(inDays(2), inDays(3))
        await request.withSession(member).post(`/me/slots/${slot.id}/signup`)
        await request.withSession(admin).post(`/admin/slots/${slot.id}/cancel`)

        const res = await request.withSession(member).get('/me/signups')

        expect(res.body.data).toHaveLength(1)
        expect(res.body.data[0]).toMatchObject({
          slotId: slot.id,
          isCancelled: true,
          canLeave: true,
        })
      })

      it('refuses a caller with no session with 401', async () => {
        expect((await request.get('/me/signups')).status).toBe(401)
      })
    })
  })
})
