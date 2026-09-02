import { Traceable } from '@amplication/opentelemetry-nestjs'
import { Injectable, Logger } from '@nestjs/common'
import { config } from '../../config/env.config'

export interface SmsOptions {
  to: string
  content: string
}

/**
 * Thin SMS sender. In development (or whenever no provider is configured) it logs the
 * message so the one-time code can be read from the API console, the same way MailDev
 * catches development emails. In production it should call the configured provider.
 */
@Traceable()
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)

  async sendSms({ to, content }: SmsOptions): Promise<void> {
    if (!config.sms.provider || config.env !== 'production') {
      this.logger.log(`[DEV SMS] to ${to}: ${content}`)
      return
    }

    // Production provider integration goes here (Twilio, OVH, etc.).
    // Kept as an explicit gap: choosing and hardening a provider is an infrastructure task.
    this.logger.warn(
      `SMS provider "${config.sms.provider}" is configured but no integration is wired; message to ${to} was not sent`,
    )
  }
}
