import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { SlotSignup } from './entities/slot-signup.entity'
import { Slot } from './entities/slot.entity'
import { AdminSlotsController } from './participation.controller'
import { ParticipationMapper } from './participation.mapper'
import { ParticipationService } from './participation.service'

/**
 * Lot 6 participation: slots members sign up for. The service takes no clock here, so it reads
 * the real one; the service spec builds it with a fixed clock instead.
 */
@Module({
  imports: [MikroOrmModule.forFeature([Slot, SlotSignup])],
  controllers: [AdminSlotsController],
  providers: [ParticipationService, ParticipationMapper],
  exports: [ParticipationService],
})
export class ParticipationModule {}
