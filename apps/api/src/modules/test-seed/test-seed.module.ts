import { Module } from '@nestjs/common'
import { TestSeedController } from './test-seed.controller'
import { TestSeedService } from './test-seed.service'

@Module({
  controllers: [TestSeedController],
  providers: [TestSeedService],
})
export class TestSeedModule {}
