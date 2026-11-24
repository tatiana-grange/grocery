import {
  memberSlotsControllerLeave,
  memberSlotsControllerListComing,
  memberSlotsControllerListMine,
  memberSlotsControllerSignUp,
} from '@grocery/openapi-generator/client/sdk.gen'
import { unwrap } from '@/lib/api-client'

export const PARTICIPATION_PAGE_SIZE = 50

const page = { offset: 0, pageSize: PARTICIPATION_PAGE_SIZE }

/** Every key the participation screens cache starts with this, so one call refreshes them all. */
export const PARTICIPATION_QUERY_KEY = 'participation'

/** The slots that have not started and are not cancelled, with whether the caller is on each. */
export function comingSlotsQueryOptions() {
  return {
    queryKey: [PARTICIPATION_QUERY_KEY, 'coming'],
    queryFn: async () => unwrap(await memberSlotsControllerListComing({ query: page })),
  }
}

/** The caller's own sign-ups on slots that have not ended, cancelled slots included. */
export function mySignupsQueryOptions() {
  return {
    queryKey: [PARTICIPATION_QUERY_KEY, 'mine'],
    queryFn: async () => unwrap(await memberSlotsControllerListMine({ query: page })),
  }
}

export async function signUpToSlot(slotId: string) {
  return unwrap(await memberSlotsControllerSignUp({ path: { slotId } }))
}

export async function leaveSlot(slotId: string) {
  return unwrap(await memberSlotsControllerLeave({ path: { slotId } }))
}
