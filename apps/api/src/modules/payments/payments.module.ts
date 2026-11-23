import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { config } from '../../config/env.config'
import { WalletModule } from '../wallet/wallet.module'
import { PaymentsService } from './payments.service'
import { DisabledPaymentProvider } from './providers/disabled-payment.provider'
import { FakePaymentProvider } from './providers/fake-payment.provider'
import { HelloAssoPaymentProvider } from './providers/helloasso-payment.provider'
import { PAYMENT_PROVIDER, type PaymentProvider } from './providers/payment-provider'
import { Topup } from './entities/topup.entity'
import { MemberTopupController, PaymentNotificationController } from './topup.controller'
import { TopupMapper } from './topup.mapper'

/**
 * Online payments. It owns the payment provider seam and the member routes. The wallet module
 * keeps the ledger. Without settings the provider is the disabled one and the app starts as usual.
 */
@Module({
  imports: [MikroOrmModule.forFeature([Topup]), WalletModule],
  controllers: [MemberTopupController, PaymentNotificationController],
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (): PaymentProvider => {
        if (config.payments.provider === 'fake') return new FakePaymentProvider()
        if (config.payments.provider === 'helloasso' && config.payments.helloasso) {
          return new HelloAssoPaymentProvider(config.payments.helloasso)
        }
        return new DisabledPaymentProvider()
      },
    },
    PaymentsService,
    TopupMapper,
  ],
  exports: [PaymentsService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
