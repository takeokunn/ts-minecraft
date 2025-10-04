import { it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { describe, expect } from 'vitest'
import {
  PerformanceMonitorApplicationService,
  PerformanceMonitorApplicationServiceLive,
} from '../performance_monitor_service'

describe('PerformanceMonitorApplicationService', () => {
  const layer = PerformanceMonitorApplicationServiceLive

  it.effect('records samples and reports averages', () =>
    Effect.gen(function* () {
      const service = yield* PerformanceMonitorApplicationService
      yield* service.record({ worldId: 'world-1', frameTime: 20, physicsTime: 5 })
      const report = yield* service.report()
      expect(report.averageFrameTime).toBeGreaterThan(0)
    }).pipe(Effect.provideLayer(layer))
  )

  it.effect.prop('classification reacts to frame time', [fc.float({ min: 10, max: 40 })], ([frameTime]) =>
    Effect.gen(function* () {
      const service = yield* PerformanceMonitorApplicationService
      yield* service.record({ worldId: 'world-1', frameTime, physicsTime: frameTime / 4 })
      const report = yield* service.report()
      expect(['good', 'warning', 'critical']).toContain(report.classification)
    }).pipe(Effect.provideLayer(layer))
  )
})
