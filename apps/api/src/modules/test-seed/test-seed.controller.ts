import { TypedRoute } from '@lonestone/nzoth/server'
import { Controller } from '@nestjs/common'
import { TestSeedResetResponse, testSeedResetResponseSchema } from './test-seed.contract'
import { TestSeedService } from './test-seed.service'

/**
 * Test-only fixtures endpoints. `TestSeedModule` is imported by `AppModule` only when
 * `config.env === 'test'`, so `/api/test/seed/*` never exists in dev or production (and never
 * reaches the generated OpenAPI client). No auth guard: the whole module is gated by env.
 */
@Controller('test/seed')
export class TestSeedController {
  constructor(private readonly testSeedService: TestSeedService) {}

  @TypedRoute.Post('reset', testSeedResetResponseSchema)
  async reset(): Promise<TestSeedResetResponse> {
    return this.testSeedService.reset()
  }
}
