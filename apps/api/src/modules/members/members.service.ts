import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { Member } from './entities/member.entity'
import { MembershipIntakeSetting } from './entities/membership-intake-setting.entity'

@Injectable()
export class MembersService {
  constructor(private readonly em: EntityManager) {}

  /** The single membership-intake settings row, created (open) on first read. */
  async getIntakeSetting(): Promise<MembershipIntakeSetting> {
    const [existing] = await this.em.find(MembershipIntakeSetting, {}, { limit: 1 })
    if (existing) return existing

    const setting = new MembershipIntakeSetting()
    this.em.persist(setting)
    await this.em.flush()
    return setting
  }

  async isIntakeOpen(): Promise<boolean> {
    return (await this.getIntakeSetting()).open
  }

  async getMemberByUserId(userId: string): Promise<Member | null> {
    return this.em.findOne(Member, { user: userId })
  }
}
