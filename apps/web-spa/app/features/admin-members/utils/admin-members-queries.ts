import type { AdminMembersControllerListData } from '@grocery/openapi-generator/client/types.gen'
import {
  adminMembersControllerDecide,
  adminMembersControllerDetail,
  adminMembersControllerList,
} from '@grocery/openapi-generator/client/sdk.gen'
import { FilterRule } from '@lonestone/nzoth/client'

type MemberFilter = NonNullable<AdminMembersControllerListData['query']['filter']>[number]

export const MEMBERS_PAGE_SIZE = 20

export interface MembersListParams {
  page: number
  search?: string
  status?: string
}

export function membersListQueryOptions({ page, search, status }: MembersListParams) {
  return {
    queryKey: ['admin-members', page, search ?? '', status ?? ''],
    queryFn: async () => {
      const filter: MemberFilter[] = [
        ...(status
          ? [{ property: 'status' as const, rule: FilterRule.EQUALS, value: status }]
          : []),
        ...(search ? [{ property: 'q' as const, rule: FilterRule.LIKE, value: search }] : []),
      ]
      const response = await adminMembersControllerList({
        query: {
          offset: (page - 1) * MEMBERS_PAGE_SIZE,
          pageSize: MEMBERS_PAGE_SIZE,
          filter,
        },
      })
      if (response.error) throw response.error
      return response.data
    },
  }
}

export function memberDetailQueryOptions(id: string) {
  return {
    queryKey: ['admin-members', 'detail', id],
    queryFn: async () => {
      const response = await adminMembersControllerDetail({ path: { id } })
      if (response.error) throw response.error
      return response.data
    },
  }
}

export async function decideMember(
  id: string,
  body:
    | { decision: 'validate'; version: number }
    | { decision: 'reject'; reason: string; version: number },
) {
  const response = await adminMembersControllerDecide({ path: { id }, body })
  if (response.error) throw response.error
  return response.data
}
