import { expect, request } from '@playwright/test'
import { E2E, storageStatePath } from './env'

type Role = 'admin' | 'member'

/** A request context signed in as one role, to set up data a screen then shows. */
export async function apiAs(role: Role) {
  return request.newContext({ baseURL: E2E.apiUrl, storageState: storageStatePath(role) })
}

/** The id of a seeded or created slot, found by its role label through the admin list. */
export async function slotIdByLabel(roleLabel: string): Promise<string> {
  const api = await apiAs('admin')
  const response = await api.get('/api/admin/slots?offset=0&pageSize=50')
  expect(response.ok(), await response.text()).toBeTruthy()
  const slots = (await response.json()).data as { id: string; roleLabel: string }[]
  await api.dispose()
  const slot = slots.find((candidate) => candidate.roleLabel === roleLabel)
  expect(slot, `le créneau « ${roleLabel} » doit exister`).toBeDefined()
  return slot!.id
}

/** Signs the given role up for a slot through the member route, with no screen involved. */
export async function signUpAs(role: Role, slotId: string): Promise<void> {
  const api = await apiAs(role)
  const response = await api.post(`/api/me/slots/${slotId}/signup`)
  expect(response.ok(), await response.text()).toBeTruthy()
  await api.dispose()
}
