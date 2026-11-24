import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { MembersModule } from '../members/members.module'
import { SlotSignup } from './entities/slot-signup.entity'
import { Slot } from './entities/slot.entity'
import { AdminSlotsController, MemberSlotsController } from './participation.controller'
import { ParticipationMapper } from './participation.mapper'
import { ParticipationService } from './participation.service'

@Module({
  imports: [MikroOrmModule.forFeature([Slot, SlotSignup]), MembersModule],
  controllers: [AdminSlotsController, MemberSlotsController],
  providers: [ParticipationService, ParticipationMapper],
  exports: [ParticipationService],
})
export class ParticipationModule {}
