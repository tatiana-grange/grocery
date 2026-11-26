import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { DistributionModule } from '../../modules/distribution/distribution.module'
import { initializeTestApp } from './test-app.helper'
import { createRequest } from './test-auth.helper'

/** Why the test app must own its address: "The test app listens on 127.0.0.1" in api-testing.mdx. */
describe('initializeTestApp', () => {
  it('binds the test app to 127.0.0.1, so no other program can answer for it', async (context) => {
    // Arrange
    const { app } = await initializeTestApp({ orm: context.orm }, { imports: [DistributionModule] })
    context.app = app
    const competingServer = createServer()

    // Act
    const actualAddress = app.getHttpServer().address() as AddressInfo | null
    const actualBindError = await new Promise<NodeJS.ErrnoException | undefined>((resolve) => {
      competingServer.once('error', resolve)
      competingServer.listen(actualAddress?.port ?? 0, '127.0.0.1', () =>
        competingServer.close(() => resolve(undefined)),
      )
    })
    const actualResponse = await createRequest(app).get('/distribution/members')

    // Assert
    expect(actualAddress?.address).toBe('127.0.0.1')
    expect(actualBindError?.code).toBe('EADDRINUSE')
    expect(actualResponse.status).toBe(401)
  })
})
