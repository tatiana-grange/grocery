import { TypedBody, TypedRoute } from '@lonestone/nzoth/server'
import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common'
import { z } from 'zod'
import { PaymentsService } from '../payments/payments.service'
import { FakePaymentProvider } from '../payments/providers/fake-payment.provider'
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payments/providers/payment-provider'

const settlePaymentSchema = z
  .object({
    providerRequestId: z.string().optional(),
    result: z.discriminatedUnion('status', [
      z.object({ status: z.literal('pending') }),
      z.object({ status: z.literal('failed') }),
      z.object({
        status: z.literal('paid'),
        providerPaymentId: z.string(),
        paidAmountCents: z.number().int(),
      }),
    ]),
  })
  .meta({
    title: 'TestSettlePayment',
    description: 'Decides the outcome of a payment request held by the fake provider',
  })
type SettlePaymentInput = z.infer<typeof settlePaymentSchema>

const okSchema = z.object({ ok: z.literal(true) }).meta({ title: 'TestPaymentsOk' })

/**
 * Test-only controls for the fake payment provider, so Playwright can play the part of the
 * payer's bank and of the provider's notification. Mounted with `TestSeedModule`, so it exists
 * only when the E2E flag is set and never reaches the generated OpenAPI client.
 */
@Controller('test/payments')
export class TestPaymentsController {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly payments: PaymentsService,
  ) {}

  @TypedRoute.Post('settle', okSchema)
  @HttpCode(HttpStatus.OK)
  settle(@TypedBody(settlePaymentSchema) body: SettlePaymentInput) {
    this.fakeProvider().settle(body.result, body.providerRequestId)
    return { ok: true as const }
  }

  @TypedRoute.Post('notify', okSchema)
  @HttpCode(HttpStatus.OK)
  async notify() {
    await this.payments.reconcileRecent()
    return { ok: true as const }
  }

  private fakeProvider(): FakePaymentProvider {
    if (this.provider instanceof FakePaymentProvider) return this.provider
    throw new InternalServerErrorException('The payment provider is not the fake one')
  }
}
