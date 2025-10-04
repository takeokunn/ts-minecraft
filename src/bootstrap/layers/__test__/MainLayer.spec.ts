import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { AppService } from '../../services/AppService'
import { MainLayer } from '../MainLayer'

describe('MainLayer', () => {
  it('MainLayer is a valid Layer instance', () => {
    expect(Layer.isLayer(MainLayer)).toBe(true)
  })

  it('MainLayer provides AppService that can report readiness', async () => {
    const status = await Effect.runPromise(
      Effect.service(AppService).pipe(
        Effect.flatMap((service) => service.getReadyStatus()),
        Effect.provideLayer(MainLayer)
      )
    )
    expect(typeof status.ready).toBe('boolean')
  })

  it('MainLayer initializes AppService successfully', async () => {
    const result = await Effect.runPromise(
      Effect.service(AppService).pipe(
        Effect.flatMap((service) => service.initialize()),
        Effect.provideLayer(MainLayer)
      )
    )
    expect(result.success).toBe(true)
  })
})
