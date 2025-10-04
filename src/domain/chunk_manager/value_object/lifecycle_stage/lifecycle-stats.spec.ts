import { describe, expect, it } from '@effect/vitest'
import {
  makeChunkLifetime,
  makeResourceUsagePercent,
  makeTimestamp,
} from '../../types/core'
import {
  averageActivationDuration,
  averageDeactivationDuration,
  createLifecycleAccumulator,
  recordActivation,
  recordDeactivation,
  setMemoryPressure,
  toLifecycleStats,
} from './lifecycle-stats'

describe('chunk_manager/value_object/lifecycle_stats', () => {
  it('records activation and deactivation events', () => {
    const now = makeTimestamp(100)
    const accumulator = createLifecycleAccumulator(now)
    const afterActivation = recordActivation(accumulator, now + 1, makeChunkLifetime(5))
    const afterDeactivation = recordDeactivation(afterActivation, now + 2, makeChunkLifetime(10), makeChunkLifetime(3))

    const stats = toLifecycleStats(setMemoryPressure(afterDeactivation, makeResourceUsagePercent(0.4)))
    expect(stats.totalActivations).toBe(1)
    expect(stats.totalDeactivations).toBe(1)
    expect(stats.memoryEfficiency).toBeCloseTo(0.6)
  })

  it('computes average durations safely when counts are zero', () => {
    const base = createLifecycleAccumulator(makeTimestamp(0))
    expect(averageActivationDuration(base)).toBe(0)
    expect(averageDeactivationDuration(base)).toBe(0)
  })
})
