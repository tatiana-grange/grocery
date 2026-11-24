import { expect, type Page, request } from '@playwright/test'
import { E2E, storageStatePath } from './env'

type Role = 'admin' | 'member'

/** A request context signed in as one role, to set up data a screen then shows. */
export async function createApiContextAs(role: Role) {
  return request.newContext({ baseURL: E2E.apiUrl, storageState: storageStatePath(role) })
}

/** The id of a seeded or created slot, found by its role label through the admin list. */
export async function findSlotIdByLabel(roleLabel: string): Promise<string> {
  const api = await createApiContextAs('admin')
  const response = await api.get('/api/admin/slots?offset=0&pageSize=50')
  expect(response.ok(), await response.text()).toBeTruthy()
  const slots = (await response.json()).data as { id: string; roleLabel: string }[]
  await api.dispose()
  const slot = slots.find((candidate) => candidate.roleLabel === roleLabel)
  expect(slot, `the slot "${roleLabel}" must exist`).toBeDefined()
  return slot!.id
}

/** Signs the given role up for a slot through the member route, with no screen involved. */
export async function signUpAs(role: Role, slotId: string): Promise<void> {
  const api = await createApiContextAs(role)
  const response = await api.post(`/api/me/slots/${slotId}/signup`)
  expect(response.ok(), await response.text()).toBeTruthy()
  await api.dispose()
}

/** A coming slot card on the member screen, found by its role label. */
export function findSlotCard(page: Page, roleLabel: string) {
  return page.locator('[data-testid^="slot-card-"]').filter({ hasText: roleLabel })
}

/** One of the member's own sign-ups, found by its role label. */
export function findMySignup(page: Page, roleLabel: string) {
  return page.locator('[data-testid^="my-signup-"]').filter({ hasText: roleLabel })
}
