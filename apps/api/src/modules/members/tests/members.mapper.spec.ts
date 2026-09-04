import { describe, expect, it } from 'vitest'
import { MembersMapper } from '../members.mapper'

describe('MembersMapper.deriveFeeState', () => {
  it('is unpaid when nothing has been paid', () => {
    // Arrange / Act / Assert
    expect(MembersMapper.deriveFeeState(2000, 0)).toBe('unpaid')
    expect(MembersMapper.deriveFeeState(2000, -500)).toBe('unpaid')
  })

  it('is partly_paid between zero and the expected amount', () => {
    expect(MembersMapper.deriveFeeState(2000, 1)).toBe('partly_paid')
    expect(MembersMapper.deriveFeeState(2000, 1999)).toBe('partly_paid')
  })

  it('is paid at or above the expected amount', () => {
    expect(MembersMapper.deriveFeeState(2000, 2000)).toBe('paid')
    expect(MembersMapper.deriveFeeState(2000, 2500)).toBe('paid')
  })

  it('is paid when nothing is expected but something was recorded', () => {
    expect(MembersMapper.deriveFeeState(0, 100)).toBe('paid')
  })
})
