import { Module } from '@nestjs/common'
import { PaymentsModule } from '../payments/payments.module'
import { TestPaymentsController } from './test-payments.controller'
import { TestSeedController } from './test-seed.controller'
import { TestSeedService } from './test-seed.service'

@Module({
  imports: [PaymentsModule],
  controllers: [TestSeedController, TestPaymentsController],
  providers: [TestSeedService],
})
export class TestSeedModule {}
