import {
  distributionControllerMemberScreen,
  distributionControllerSearchMembers,
} from '@grocery/openapi-generator/client/sdk.gen'
import type { DistributionControllerSearchMembersData } from '@grocery/openapi-generator/client/types.gen'
import { FilterRule } from '@lonestone/nzoth/client'
import { unwrap } from '@/lib/api-client'

export const DISTRIBUTION_MEMBER_PAGE_SIZE = 10

type MemberFilter = NonNullable<DistributionControllerSearchMembersData['query']['filter']>[number]

export function distributionMemberSearchQueryOptions(search: string) {
  return {
    queryKey: ['distribution', 'members', search],
    queryFn: async () => {
      const filter: MemberFilter[] = search
        ? [{ property: 'search' as const, rule: FilterRule.LIKE, value: search }]
        : []
      return unwrap(
        await distributionControllerSearchMembers({
          query: { offset: 0, pageSize: DISTRIBUTION_MEMBER_PAGE_SIZE, filter },
        }),
      )
    },
    // Nothing typed yet means nothing to show; the table searches on every keystroke.
    enabled: search.trim().length > 0,
  }
}

/**
 * The whole table screen in one call: member, status, balance, and every outstanding order
 * with its lines and shelf quantities. One round trip, because SC-005 budgets the entire
 * handover at 60 seconds with a queue waiting.
 */
export function distributionMemberScreenQueryOptions(memberId: string) {
  return {
    queryKey: ['distribution', 'member-screen', memberId],
    queryFn: async () => unwrap(await distributionControllerMemberScreen({ path: { memberId } })),
  }
}
