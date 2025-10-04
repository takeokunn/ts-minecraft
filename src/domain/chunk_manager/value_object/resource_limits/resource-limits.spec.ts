import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import {
  makeChunkDistance,
  makeMaxActiveChunks,
  makeResourceUsagePercent,
} from '../../types/core'
import { makeAutoManagementConfig } from '../../types/interfaces'
import {
  blendMemoryPressure,
  computeTargetActiveChunks,
  shouldEvictChunks,
  shouldThrottleActivations,
} from './resource-limits'

const autoConfig = makeAutoManagementConfig({
  enabled: true,
  activationDistance: makeChunkDistance(8),
  deactivationDistance: makeChunkDistance(12),
  maxActiveChunks: makeMaxActiveChunks(16),
  memoryThreshold: makeResourceUsagePercent(0.6),
  performanceThreshold: makeResourceUsagePercent(0.8),
})

const moderateLoad = {
  cpu: makeResourceUsagePercent(0.3),
  memory: makeResourceUsagePercent(0.5),
  network: makeResourceUsagePercent(0.2),
  fps: 120,
}

describe('chunk_manager/value_object/resource_limits', () => {
  it.effect('shouldThrottleActivations respects max active chunk limit', () =>
    Effect.gen(function* () {
      const result = yield* shouldThrottleActivations(autoConfig, moderateLoad, 16)
      expect(result).toBe(true)
    })
  )

  it.effect('shouldEvictChunks reacts to memory pressure', () =>
    Effect.gen(function* () {
      const highMemoryLoad = { ...moderateLoad, memory: makeResourceUsagePercent(0.9) }
      const result = yield* shouldEvictChunks(autoConfig, highMemoryLoad, 10)
      expect(result).toBe(true)
    })
  )

  it.effect('computeTargetActiveChunks scales with load', () =>
    Effect.gen(function* () {
      const target = yield* computeTargetActiveChunks(autoConfig, moderateLoad)
      expect(Number(target)).toBeGreaterThan(0)
      expect(Number(target)).toBeLessThanOrEqual(Number(autoConfig.maxActiveChunks))
    })
  )

  it('blendMemoryPressure averages current and load', () => {
    const blended = blendMemoryPressure(makeResourceUsagePercent(0.4), moderateLoad)
    expect(blended).toBeCloseTo(0.45)
  })

  it.effect('blendMemoryPressure stays within bounds (fuzz)', () =>
    Effect.forEach(Array.from({ length: 200 }), () =>
      Effect.sync(() => {
        const current = Math.random()
        const memory = Math.random()
        const result = blendMemoryPressure(makeResourceUsagePercent(current), {
          ...moderateLoad,
          memory: makeResourceUsagePercent(memory),
        })
        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThanOrEqual(1)
      })
    )
  )
})
