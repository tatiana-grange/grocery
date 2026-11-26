import { Traceable } from '@amplication/opentelemetry-nestjs'
import { Injectable, Logger } from '@nestjs/common'
import { createTransport, Transporter } from 'nodemailer'
import { config } from '../../config/env.config'
import { EMAIL_LOGO_CID, EMAIL_LOGO_PATH, EMAIL_LOGO_SRC } from './email-logo'

export interface EmailAttachment {
  filename: string
  content: string
  contentType: string
}

/** The logo, attached inline: the HTML points at it with `cid:`. */
interface InlineLogoAttachment {
  filename: string
  path: string
  cid: string
  contentType: string
}

export interface EmailOptions {
  to: string
  /** Addresses that get a copy. Left out of the message when empty. */
  cc?: string[]
  subject: string
  content: string
  html?: string
  /** Files attached to the message. Left out of the message when empty. */
  attachments?: EmailAttachment[]
}

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  auth?: {
    user: string
    pass: string
  }
}

@Traceable()
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private transporter: Transporter

  constructor() {
    const transportConfig: SmtpConfig = {
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
    }

    // Only add auth if user and password are provided
    if (config.email.user && config.email.password) {
      transportConfig.auth = {
        user: config.email.user,
        pass: config.email.password,
      }
    }

    this.transporter = createTransport(transportConfig)
  }

  async sendEmail({ to, cc, subject, content, html, attachments }: EmailOptions): Promise<void> {
    try {
      // The logo goes after the caller's attachments, and only when the HTML shows it.
      const allAttachments: Array<EmailAttachment | InlineLogoAttachment> = [
        ...(attachments ?? []),
        ...(html?.includes(EMAIL_LOGO_SRC)
          ? [
              {
                filename: 'logo.jpg',
                path: EMAIL_LOGO_PATH,
                cid: EMAIL_LOGO_CID,
                contentType: 'image/jpeg',
              },
            ]
          : []),
      ]
      const mailOptions = {
        from: `"${config.cooperative.name}" <${config.email.from}>`,
        to,
        subject,
        text: content,
        html: html || content,
        ...(cc?.length ? { cc } : {}),
        ...(allAttachments.length ? { attachments: allAttachments } : {}),
      }

      const info = await this.transporter.sendMail(mailOptions)

      this.logger.log(`Email sent successfully to ${to}: ${info.messageId}`)
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error)
      throw new Error(
        `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      this.logger.log('Email service connection verified successfully')
      return true
    } catch (error) {
      this.logger.error('Email service connection verification failed:', error)
      return false
    }
  }
}
