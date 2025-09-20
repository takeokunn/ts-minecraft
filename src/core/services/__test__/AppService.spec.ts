import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import { AppService, AppServiceLive } from '../AppService'

describe('AppService', () => {
  it.effect('should initialize successfully', () =>
    Effect.gen(function* () {
      const service = yield* AppService
      yield* service.initialize()
      return true
    }).pipe(Effect.provide(AppServiceLive))
  )

  it.effect('should return ready status', () =>
    Effect.gen(function* () {
      const service = yield* AppService
      const status = yield* service.getStatus()
      expect(status).toEqual({ ready: true })
    }).pipe(Effect.provide(AppServiceLive))
  )
})
