import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { makeChunkLifetime, makeMemoryBytes, makeResourceUsagePercent } from '../../types/core'
import { makeMemoryUsage, makePerformanceMetrics, makePoolMetrics } from './pool_metrics'

describe('chunk_manager/value_object/pool_metrics', () => {
  it.effect('makePoolMetrics succeeds with consistent counts', () =>
    Effect.gen(function* () {
      const usage = makeMemoryUsage({
        total: makeMemoryBytes(1024),
        active: makeMemoryBytes(512),
        cached: makeMemoryBytes(256),
      })
      const performance = makePerformanceMetrics({
        activationTime: makeChunkLifetime(5),
        deactivationTime: makeChunkLifetime(4),
        memoryPressure: makeResourceUsagePercent(0.5),
      })

      const metrics = yield* makePoolMetrics({
        totalChunks: 10,
        activeChunks: 4,
        inactiveChunks: 3,
        memoryUsage: usage,
        performance,
      })

      expect(metrics.totalChunks).toBe(10)
      expect(metrics.performanceMetrics.memoryPressure).toBeCloseTo(0.75)
    })
  )

  it.effect('makePoolMetrics fails when counts inconsistent', () =>
    Effect.gen(function* () {
      const usage = makeMemoryUsage({
        total: makeMemoryBytes(1024),
        active: makeMemoryBytes(900),
        cached: makeMemoryBytes(300),
      })
      const performance = makePerformanceMetrics({
        activationTime: makeChunkLifetime(5),
        deactivationTime: makeChunkLifetime(4),
        memoryPressure: makeResourceUsagePercent(0.5),
      })

      const result = yield* makePoolMetrics({
        totalChunks: 1,
        activeChunks: 2,
        inactiveChunks: 0,
        memoryUsage: usage,
        performance,
      }).pipe(Effect.exit)

      expect(result._tag).toBe('Failure')
    })
  )
})
