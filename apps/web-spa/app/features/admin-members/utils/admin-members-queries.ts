import type {
  AdminMembersControllerListData,
  AdminMembersControllerRecordFeePaymentData,
  AdminMembersControllerSetFeeData,
  AdminMembersControllerUpdateProfileData,
} from '@grocery/openapi-generator/client/types.gen'
import {
  adminMembersControllerCreate,
  adminMembersControllerDecide,
  adminMembersControllerDetail,
  adminMembersControllerList,
  adminMembersControllerListFeePayments,
  adminMembersControllerReactivate,
  adminMembersControllerRecordFeePayment,
  adminMembersControllerSetFee,
  adminMembersControllerSetRoles,
  adminMembersControllerTerminate,
  adminMembersControllerUpdateProfile,
} from '@grocery/openapi-generator/client/sdk.gen'
import { FilterRule } from '@lonestone/nzoth/client'
import { unwrap } from '@/lib/api-client'

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

export const updateMemberProfile = async (
  id: string,
  body: AdminMembersControllerUpdateProfileData['body'],
) => unwrap(await adminMembersControllerUpdateProfile({ path: { id }, body }))

export const setMemberFee = async (id: string, body: AdminMembersControllerSetFeeData['body']) =>
  unwrap(await adminMembersControllerSetFee({ path: { id }, body }))

export const recordFeePayment = async (
  id: string,
  body: AdminMembersControllerRecordFeePaymentData['body'],
) => unwrap(await adminMembersControllerRecordFeePayment({ path: { id }, body }))

export function feePaymentsQueryOptions(id: string) {
  return {
    queryKey: ['admin-members', 'fee-payments', id],
    queryFn: async () => unwrap(await adminMembersControllerListFeePayments({ path: { id } })),
  }
}

export const createMember = async (input: { name: string; email?: string; phoneNumber?: string }) =>
  unwrap(
    await adminMembersControllerCreate({
      body: { ...input, roles: ['member'], status: 'active' },
    }),
  )

export const setMemberRoles = async (
  id: string,
  body: { roles: ('member' | 'admin')[]; version: number },
) => unwrap(await adminMembersControllerSetRoles({ path: { id }, body }))

export const terminateMember = async (id: string, body: { reason: string; version: number }) =>
  unwrap(await adminMembersControllerTerminate({ path: { id }, body }))

export const reactivateMember = async (id: string, body: { version: number }) =>
  unwrap(await adminMembersControllerReactivate({ path: { id }, body }))
