import {
  adminSlotsControllerCancel,
  adminSlotsControllerCreate,
  adminSlotsControllerDetail,
  adminSlotsControllerList,
  adminSlotsControllerRemove,
  adminSlotsControllerRemoveMember,
  adminSlotsControllerSignUpMember,
  adminSlotsControllerUpdate,
} from '@grocery/openapi-generator/client/sdk.gen'
import type { SlotInput } from '@grocery/openapi-generator/client/types.gen'
import { unwrap } from '@/lib/api-client'

export const ADMIN_SLOTS_PAGE_SIZE = 50

/** Every key the back-office slot screens cache starts with this, so one call refreshes them all. */
export const ADMIN_PARTICIPATION_QUERY_KEY = 'admin-participation'

export function adminSlotsQueryOptions({
  page,
  includePast,
}: {
  page: number
  includePast: boolean
}) {
  return {
    queryKey: [ADMIN_PARTICIPATION_QUERY_KEY, 'list', page, includePast],
    queryFn: async () =>
      unwrap(
        await adminSlotsControllerList({
          query: {
            offset: (page - 1) * ADMIN_SLOTS_PAGE_SIZE,
            pageSize: ADMIN_SLOTS_PAGE_SIZE,
            includePast,
          },
        }),
      ),
  }
}

export function adminSlotDetailQueryOptions(slotId: string) {
  return {
    queryKey: [ADMIN_PARTICIPATION_QUERY_KEY, 'detail', slotId],
    queryFn: async () => unwrap(await adminSlotsControllerDetail({ path: { slotId } })),
  }
}

export async function createSlot(body: SlotInput) {
  return unwrap(await adminSlotsControllerCreate({ body }))
}

export async function updateSlot(slotId: string, body: SlotInput) {
  return unwrap(await adminSlotsControllerUpdate({ path: { slotId }, body }))
}

/** Cancelling is final: the slot never goes back to live. */
export async function cancelSlot(slotId: string) {
  return unwrap(await adminSlotsControllerCancel({ path: { slotId } }))
}

export async function deleteSlot(slotId: string) {
  return unwrap(await adminSlotsControllerRemove({ path: { slotId } }))
}

export async function signUpMember(slotId: string, memberId: string) {
  return unwrap(await adminSlotsControllerSignUpMember({ path: { slotId }, body: { memberId } }))
}

export async function removeMember(slotId: string, memberId: string) {
  return unwrap(await adminSlotsControllerRemoveMember({ path: { slotId, memberId } }))
}
