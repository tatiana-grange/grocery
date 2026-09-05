import {
  memberSelfControllerMe,
  memberSelfControllerTerminate,
  memberSelfControllerUpdateProfile,
} from '@grocery/openapi-generator/client/sdk.gen'
import type { MemberSelfControllerUpdateProfileData } from '@grocery/openapi-generator/client/types.gen'
import { unwrap } from '@/lib/api-client'

export function myAccountQueryOptions() {
  return {
    queryKey: ['members', 'me'],
    queryFn: async () => unwrap(await memberSelfControllerMe()),
  }
}

export const updateMyProfile = async (body: MemberSelfControllerUpdateProfileData['body']) =>
  unwrap(await memberSelfControllerUpdateProfile({ body }))

export const endMyMembership = async () =>
  unwrap(await memberSelfControllerTerminate({ body: { confirm: true } }))
