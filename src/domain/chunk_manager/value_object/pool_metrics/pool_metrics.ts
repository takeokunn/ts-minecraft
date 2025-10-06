import { Effect, Match } from 'effect'
import type { MemoryUsage, PerformanceMetrics, PoolMetrics } from '../../types'
import { ResourceUsagePercent, makeMemoryBytes, makePoolMetricsError, makeResourceUsagePercent } from '../../types'

const computeMemoryPressureValue = (usage: MemoryUsage): ResourceUsagePercent =>
  makeResourceUsagePercent(usage.total === 0 ? 0 : Math.min(1, (usage.active + usage.cached) / usage.total))

const ensureCounts = (total: number, active: number, inactive: number) => total >= active + inactive

const ensureMemoryBudget = (usage: MemoryUsage) => usage.total >= usage.active + usage.cached

export const makeMemoryUsage = (params: MemoryUsage): MemoryUsage => params

export const makePerformanceMetrics = (params: PerformanceMetrics): PerformanceMetrics => params

export const makePoolMetrics = (params: {
  readonly totalChunks: number
  readonly activeChunks: number
  readonly inactiveChunks: number
  readonly memoryUsage: MemoryUsage
  readonly performance: PerformanceMetrics
}): Effect.Effect<PoolMetrics, ReturnType<typeof makePoolMetricsError>> =>
  Effect.gen(function* () {
    yield* Match.value(ensureCounts(params.totalChunks, params.activeChunks, params.inactiveChunks)).pipe(
      Match.when(true, () => Effect.void),
      Match.orElse(() =>
        Effect.fail(
          makePoolMetricsError({
            _tag: 'InvalidCounts',
            total: params.totalChunks,
            active: params.activeChunks,
            inactive: params.inactiveChunks,
          })
        )
      )
    )

    yield* Match.value(ensureMemoryBudget(params.memoryUsage)).pipe(
      Match.when(true, () => Effect.void),
      Match.orElse(() =>
        Effect.fail(
          makePoolMetricsError({
            _tag: 'NegativeMemory',
            invalidUsage: makeMemoryBytes(
              Math.max(0, params.memoryUsage.active + params.memoryUsage.cached - params.memoryUsage.total)
            ),
          })
        )
      )
    )

    return {
      totalChunks: params.totalChunks,
      activeChunks: params.activeChunks,
      inactiveChunks: params.inactiveChunks,
      memoryUsage: params.memoryUsage,
      performanceMetrics: {
        ...params.performance,
        memoryPressure: computeMemoryPressureValue(params.memoryUsage),
      },
    }
  })

export const computeMemoryPressure = computeMemoryPressureValue
