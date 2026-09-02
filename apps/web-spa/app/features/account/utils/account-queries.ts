import {
  memberSelfControllerMe,
  memberSelfControllerTerminate,
  memberSelfControllerUpdateProfile,
} from '@grocery/openapi-generator/client/sdk.gen'
import type { MemberSelfControllerUpdateProfileData } from '@grocery/openapi-generator/client/types.gen'

function unwrap<T>(response: { data?: T; error?: unknown }): T {
  if (response.error) throw response.error
  return response.data as T
}

export function myAccountQueryOptions() {
  return {
    queryKey: ['members', 'me'],
    queryFn: async () => unwrap(await memberSelfControllerMe()),
  }
}

export const updateMyProfile = async (
  body: MemberSelfControllerUpdateProfileData['body'],
) => unwrap(await memberSelfControllerUpdateProfile({ body }))

export const endMyMembership = async () =>
  unwrap(await memberSelfControllerTerminate({ body: { confirm: true } }))
