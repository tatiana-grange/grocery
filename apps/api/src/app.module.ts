import { IncomingMessage, ServerResponse } from 'node:http'
import { OpenTelemetryModule } from '@amplication/opentelemetry-nestjs'
import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup'
import { LoggerModule } from 'nestjs-pino'
import { AppController } from './app.controller'
import { config } from './config/env.config'
import { AuthModule } from './modules/auth/auth.module'
import { DbModule } from './modules/db/db.module'
import { CatalogModule } from './modules/catalog/catalog.module'
import { EmailModule } from './modules/email/email.module'
import { MembersModule } from './modules/members/members.module'
import { TestSeedModule } from './modules/test-seed/test-seed.module'

// Extended interface for Express requests
interface ExpressRequest extends IncomingMessage {
  originalUrl?: string
}

// Extended interface for Express responses
interface ExpressResponse extends ServerResponse<IncomingMessage> {
  responseTime?: number
}

@Module({
  imports: [
    OpenTelemetryModule.forRoot(),
    SentryModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            levelFirst: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss',
            singleLine: true,
            messageFormat: false,
            ignore: 'pid,hostname,req,res,context,responseTime',
          },
        },
        autoLogging: true,
        serializers: {
          req: () => {
            return undefined // Don't log request details
          },
          res: () => {
            return undefined // Don't log response details
          },
        },
        // Filter out OpenAPI generator spam
        customReceivedMessage: (req: ExpressRequest) => {
          const url = req.originalUrl || req.url || ''
          // Skip logging for OpenAPI docs requests
          if (url.includes('/docs-json') || url.includes('/docs')) {
            return '' // Return false to skip logging this request
          }
          return `request received: ${req.method} ${url}`
        },
        customLogLevel: (req: ExpressRequest, res: ExpressResponse, error?: Error) => {
          if (res.statusCode >= 500 || error) {
            return 'error'
          } else if (res.statusCode >= 400) {
            return 'warn'
          }
          return 'info'
        },
        customSuccessMessage: (req: ExpressRequest, res: ExpressResponse) => {
          const originalUrl = req.originalUrl || req.url || ''
          // Skip logging for OpenAPI docs requests
          if (originalUrl.includes('/docs-json') || originalUrl.includes('/docs')) {
            return '' // Return false to skip logging this response
          }
          const method = req.method || ''
          const statusCode = res.statusCode
          const responseTime = res.responseTime || 0
          return `${method} ${originalUrl} ${statusCode} - ${responseTime}ms`
        },
        customErrorMessage: (req: ExpressRequest, res: ExpressResponse) => {
          const originalUrl = req.originalUrl || req.url || ''
          // Skip logging for OpenAPI docs requests
          if (originalUrl.includes('/docs-json') || originalUrl.includes('/docs')) {
            return '' // Return false to skip logging this response
          }
          const method = req.method || ''
          const statusCode = res.statusCode
          const responseTime = res.responseTime || 0
          return `${method} ${originalUrl} ${statusCode} - ${responseTime}ms`
        },
      },
    }),
    DbModule,
    AuthModule,
    EmailModule,
    NestConfigModule,
    MembersModule,
    CatalogModule,
    // Test-only fixtures endpoints (`/api/test/seed/*`). Gated on the dedicated `E2E` flag
    // (set only by the Playwright web-spa e2e run), not `NODE_ENV`, so it never mounts during
    // the API's own vitest suites.
    ...(config.e2e ? [TestSeedModule] : []),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule {}
