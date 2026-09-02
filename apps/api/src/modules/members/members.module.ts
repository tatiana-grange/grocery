import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { EmailModule } from '../email/email.module'
import { MemberStatusChange } from './entities/member-status-change.entity'
import { MembershipFee } from './entities/membership-fee.entity'
import { MembershipIntakeSetting } from './entities/membership-intake-setting.entity'
import { MembershipPayment } from './entities/membership-payment.entity'
import { Member } from './entities/member.entity'
import {
  AdminMembersController,
  MemberSelfController,
  MembershipIntakeController,
} from './members.controller'
import { MembersMapper } from './members.mapper'
import { MembersService } from './members.service'

@Module({
  imports: [
    EmailModule,
    MikroOrmModule.forFeature([
      Member,
      MemberStatusChange,
      MembershipFee,
      MembershipPayment,
      MembershipIntakeSetting,
    ]),
  ],
  controllers: [AdminMembersController, MemberSelfController, MembershipIntakeController],
  providers: [MembersService, MembersMapper],
  exports: [MembersService, MembersMapper],
})
export class MembersModule {}
