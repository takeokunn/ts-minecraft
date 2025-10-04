import { it } from '@effect/vitest'
import { Context, Effect, Layer, Schema } from 'effect'
import * as fc from 'effect/FastCheck'
import { describe, expect } from 'vitest'
import {
  PerformanceMonitorApplicationService,
  PerformanceMonitorApplicationServiceLive,
} from '../performance-monitor-service'
import { PhysicsWorldIdSchema } from '../../types/core'

describe('PerformanceMonitorApplicationService', () => {
  const layer = PerformanceMonitorApplicationServiceLive
  const decodeWorldId = Schema.decodeUnknownSync(PhysicsWorldIdSchema)

  const withService = <A>(
    use: (service: PerformanceMonitorApplicationService) => Effect.Effect<A>
  ): Effect.Effect<A> =>
    Effect.scoped(
      Layer.build(layer).pipe(
        Effect.flatMap((env) => use(Context.get(env, PerformanceMonitorApplicationService)))
      )
    )

  it.effect.prop(
    'records samples and reports averages',
    [
      fc.array(
        fc.record({
          frameTime: fc.float({ min: 1, max: 60, noNaN: true }),
          physicsTime: fc.float({ min: 0, max: 50, noNaN: true }),
        }),
        { minLength: 1, maxLength: 60 }
      ),
    ],
    ([rawSamples]) =>
      withService((service) =>
        Effect.gen(function* () {
          const worldId = decodeWorldId('world-monitor')

          yield* Effect.forEach(
            rawSamples,
            (sample) =>
              service.record({
                worldId,
                frameTime: sample.frameTime,
                physicsTime: sample.physicsTime,
              }),
            { concurrency: 'unbounded' }
          )

          const report = yield* service.report()
          const expectedFrameAverage = rawSamples.reduce((acc, sample) => acc + sample.frameTime, 0) / rawSamples.length
          const expectedPhysicsAverage =
            rawSamples.reduce((acc, sample) => acc + sample.physicsTime, 0) / rawSamples.length

          expect(report.averageFrameTime).toBeCloseTo(expectedFrameAverage, 6)
          expect(report.averagePhysicsTime).toBeCloseTo(expectedPhysicsAverage, 6)
        })
      )
  )

  it.effect('classification reacts to frame time', () =>
    withService((service) =>
      Effect.gen(function* () {
        const worldId = decodeWorldId('world-monitor-classification')
        const buildSample = (frameTime: number, physicsTime: number = frameTime / 2) => ({
          worldId,
          frameTime,
          physicsTime,
        })

        yield* service.record(buildSample(16, 6))
        let report = yield* service.report()
        expect(report.classification).toBe('good')

        yield* service.record(buildSample(30, 12))
        report = yield* service.report()
        expect(report.classification).toBe('warning')

        yield* service.record(buildSample(70, 20))
        report = yield* service.report()
        expect(report.classification).toBe('critical')
      })
    )
  )
})
