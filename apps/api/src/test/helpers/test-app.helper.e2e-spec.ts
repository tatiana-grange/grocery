import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { DistributionModule } from '../../modules/distribution/distribution.module'
import { initializeTestApp } from './test-app.helper'
import { createRequest } from './test-auth.helper'

/**
 * The test app must own its address. Supertest used to start the server on a random port open
 * on every address and then call `127.0.0.1` on that port. macOS can hand out a port another
 * program holds on `127.0.0.1` only, and that program then answered in the app's place.
 */
describe('initializeTestApp', () => {
  it('the test app owns its port on 127.0.0.1', async (context) => {
    const { app } = await initializeTestApp({ orm: context.orm }, { imports: [DistributionModule] })
    context.app = app

    const address = app.getHttpServer().address() as AddressInfo | null
    expect(address?.address).toBe('127.0.0.1')

    const intruder = createServer()
    const bindError = await new Promise<NodeJS.ErrnoException | undefined>((resolve) => {
      intruder.once('error', resolve)
      intruder.listen(address!.port, '127.0.0.1', () => intruder.close(() => resolve(undefined)))
    })
    expect(bindError?.code).toBe('EADDRINUSE')

    const res = await createRequest(app).get('/distribution/members')
    expect(res.status).toBe(401)
  })
})
