import type { EntityManager, MikroORM } from '@mikro-orm/core'
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import { cleanupTestOrm, createTestOrm } from '../../../test/helpers/test-db.helper'
import { createMemberData } from '../../members/members.factory'
import { SlotSignup } from '../entities/slot-signup.entity'
import { Slot } from '../entities/slot.entity'
import { ParticipationService } from '../participation.service'

const HOUR = 60 * 60 * 1000
/** The cooperative's clock, fixed so the rules read the same moment on every run. */
const NOW = new Date('2026-12-01T09:00:00Z')

describe('ParticipationService (database)', () => {
  let orm: MikroORM
  let em: EntityManager
  let service: ParticipationService

  beforeEach(async () => {
    orm = (await createTestOrm(inject('pgConfig'))).orm
    em = orm.em.fork()
    service = serviceOnNewEm()
  })

  afterEach(async () => {
    await cleanupTestOrm(orm)
  })

  /** A service on its own entity manager, as two requests at once would each have. */
  function serviceOnNewEm() {
    return new ParticipationService(orm.em.fork(), () => NOW)
  }

  async function makeMember(name: string) {
    const { member } = await createMemberData(em, { user: { name }, status: 'active' })
    return member
  }

  /** A slot starting `fromHours` after NOW and lasting `hours`. */
  async function makeSlot(fromHours: number, hours: number, places = 2, cancelled = false) {
    const slot = new Slot()
    slot.roleLabel = 'Run the distribution'
    slot.startsAt = new Date(NOW.getTime() + fromHours * HOUR)
    slot.endsAt = new Date(slot.startsAt.getTime() + hours * HOUR)
    slot.places = places
    if (cancelled) slot.cancelledAt = NOW
    em.persist(slot)
    await em.flush()
    return slot
  }

  /**
   * Opens several database connections before a race. A new connection takes longer to open than
   * a whole sign-up, so without this the first call would finish before the others began and
   * a missing lock would go unseen.
   */
  async function warmPool(connections = 6) {
    await Promise.all(
      Array.from({ length: connections }, () =>
        orm.em.fork().getConnection().execute('select pg_sleep(0.2)'),
      ),
    )
  }

  const signupsOn = (slotId: string) => orm.em.fork().count(SlotSignup, { slot: slotId })
  const signUp = (slotId: string, memberId: string, svc = service) =>
    svc.signUp({ slotId, memberId, actor: 'member' })

  describe('the no-overlap rule', () => {
    it('refuses a second slot that overlaps one the member holds (overlaps_another_slot)', async () => {
      const ada = await makeMember('Ada')
      const morning = await makeSlot(48, 4)
      const lateMorning = await makeSlot(50, 4)
      await signUp(morning.id, ada.id)

      await expect(signUp(lateMorning.id, ada.id)).rejects.toMatchObject({
        status: 409,
        response: { code: 'overlaps_another_slot' },
      })
      expect(await signupsOn(lateMorning.id)).toBe(0)
    })

    it('refuses a slot that sits inside, and one that contains, a slot the member holds', async () => {
      const ada = await makeMember('Ada')
      const long = await makeSlot(48, 8)
      const inside = await makeSlot(50, 2)
      await signUp(long.id, ada.id)

      await expect(signUp(inside.id, ada.id)).rejects.toMatchObject({
        response: { code: 'overlaps_another_slot' },
      })
    })

    it('allows two slots that touch, one ending when the next starts', async () => {
      const ada = await makeMember('Ada')
      const first = await makeSlot(48, 4)
      const second = await makeSlot(52, 4)
      await signUp(first.id, ada.id)

      await signUp(second.id, ada.id)

      expect(await signupsOn(second.id)).toBe(1)
    })

    it('does not count a cancelled slot the member holds', async () => {
      const ada = await makeMember('Ada')
      const live = await makeSlot(48, 4)
      await signUp(live.id, ada.id)
      await service.cancelSlot(live.id)
      const overlapping = await makeSlot(49, 4)

      await signUp(overlapping.id, ada.id)

      expect(await signupsOn(overlapping.id)).toBe(1)
    })

    it('does not count slots another member holds', async () => {
      const ada = await makeMember('Ada')
      const bob = await makeMember('Bob')
      const morning = await makeSlot(48, 4)
      const overlapping = await makeSlot(49, 4)
      await signUp(morning.id, bob.id)

      await signUp(overlapping.id, ada.id)

      expect(await signupsOn(overlapping.id)).toBe(1)
    })

    it('reports already_signed_up, not an overlap, for the same slot twice', async () => {
      const ada = await makeMember('Ada')
      const slot = await makeSlot(48, 4)
      await signUp(slot.id, ada.id)

      await expect(signUp(slot.id, ada.id)).rejects.toMatchObject({
        response: { code: 'already_signed_up' },
      })
    })
  })

  describe('two sign-ups at the same moment', () => {
    it('lets one of two members win the last place and refuses the other with slot_full', async () => {
      const ada = await makeMember('Ada')
      const bob = await makeMember('Bob')
      const slot = await makeSlot(48, 4, 1)

      await warmPool()

      const results = await Promise.allSettled([
        signUp(slot.id, ada.id, serviceOnNewEm()),
        signUp(slot.id, bob.id, serviceOnNewEm()),
      ])

      const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(refused).toHaveLength(1)
      expect(refused[0]?.reason).toMatchObject({ status: 409, response: { code: 'slot_full' } })
      expect(await signupsOn(slot.id)).toBe(1)
    })

    it('never leaves more sign-ups than places when an admin lowers the places during a sign-up', async () => {
      const ada = await makeMember('Ada')
      const bob = await makeMember('Bob')
      const slot = await makeSlot(48, 4, 2)
      await signUp(slot.id, ada.id)

      await warmPool()

      await Promise.allSettled([
        serviceOnNewEm().updateSlot(slot.id, {
          roleLabel: slot.roleLabel,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          places: 1,
        }),
        signUp(slot.id, bob.id, serviceOnNewEm()),
      ])

      const stored = await orm.em.fork().findOneOrFail(Slot, slot.id)
      expect(await signupsOn(slot.id)).toBeLessThanOrEqual(stored.places)
    })

    it('never holds two overlapping slots when one member signs up for both at once', async () => {
      const ada = await makeMember('Ada')
      const morning = await makeSlot(48, 4)
      const lateMorning = await makeSlot(50, 4)

      await warmPool()

      const results = await Promise.allSettled([
        signUp(morning.id, ada.id, serviceOnNewEm()),
        signUp(lateMorning.id, ada.id, serviceOnNewEm()),
      ])

      const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(refused).toHaveLength(1)
      expect(refused[0]?.reason).toMatchObject({
        status: 409,
        response: { code: 'overlaps_another_slot' },
      })
      const held = await orm.em.fork().count(SlotSignup, { member: ada.id })
      expect(held).toBe(1)
    })

    it('holds exactly one of five overlapping slots when one member signs up for all at once', async () => {
      const ada = await makeMember('Ada')
      const slots = await Promise.all([48, 49, 50, 51, 52].map((from) => makeSlot(from, 6)))

      await warmPool()

      const results = await Promise.allSettled(
        slots.map((slot) => signUp(slot.id, ada.id, serviceOnNewEm())),
      )

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(await orm.em.fork().count(SlotSignup, { member: ada.id })).toBe(1)
    })
  })
})
