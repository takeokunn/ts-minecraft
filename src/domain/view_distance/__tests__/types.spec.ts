import { describe, expect, it, prop } from '@effect/vitest'
import { Effect } from 'effect'
import * as FC from 'effect/FastCheck'
import {
  adjustRenderPriority,
  clampViewDistance,
  createCameraState,
  createCullableObject,
  createManagedObject,
  createPerformanceMetrics,
  createViewControlConfig,
  decodeCameraState,
  decodeCullableObject,
  decodeManagedObject,
  decodePerformanceMetrics,
  decodeViewControlConfig,
  deriveCullableFromManaged,
  emptyViewControlResult,
  toEpochMillis,
  toRenderPriority,
  toViewDistance,
} from '../types'

describe('view_distance/types', () => {
  it.effect('toViewDistance validates bounds', () =>
    Effect.gen(function* () {
      const valid = yield* toViewDistance(32)
      expect(valid).toBe(32)

      const invalid = yield* Effect.flip(toViewDistance(100))
      expect(invalid).toHaveProperty('_tag', 'InvalidDistanceError')
      expect(invalid).toHaveProperty('input', 100)
    })
  )

  prop('toRenderPriority clamps value within [0,1]', [FC.double({ min: -5, max: 5, noNaN: true })], (value) => {
    const priority = Effect.runSync(toRenderPriority(value))
    expect(priority).toBeGreaterThanOrEqual(0)
    expect(priority).toBeLessThanOrEqual(1)
  })

  it.effect('toRenderPriority reports invalid numeric input', () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(toRenderPriority(Number.NaN))
      expect(error).toHaveProperty('_tag', 'InvalidConfigurationError')
    })
  )

  it.effect('decodeViewControlConfig rejects inverted distances', () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        decodeViewControlConfig({
          minViewDistance: 40,
          maxViewDistance: 10,
          updateIntervalMillis: 16,
          hysteresis: 0.2,
          adaptiveQuality: true,
        })
      )
      expect(failure).toHaveProperty('_tag', 'InvalidConfigurationError')
      expect(failure.issues).toContain('minViewDistance must be less than or equal to maxViewDistance')
    })
  )

  it.effect('decodeViewControlConfig formats schema violations', () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(decodeViewControlConfig(42))
      expect(failure).toHaveProperty('_tag', 'InvalidConfigurationError')
      expect(failure.issues.at(0)).toContain('Expected')
    })
  )

  it.effect('decodeViewControlConfig accepts consistent boundaries', () =>
    Effect.gen(function* () {
      const config = yield* decodeViewControlConfig({
        minViewDistance: 8,
        maxViewDistance: 24,
        updateIntervalMillis: 50,
        hysteresis: 0.1,
        adaptiveQuality: false,
      })
      expect(config.minViewDistance).toBe(8)
      expect(config.maxViewDistance).toBe(24)
      expect(config.adaptiveQuality).toBe(false)
    })
  )

  it.effect('adjustRenderPriority keeps result in range', () =>
    Effect.gen(function* () {
      const base = yield* toRenderPriority(0.5)
      const increased = yield* adjustRenderPriority(base, 0.7)
      const decreased = yield* adjustRenderPriority(base, -0.8)

      expect(increased).toBeCloseTo(1, 5)
      expect(decreased).toBeCloseTo(0, 5)
    })
  )

  it.effect('clampViewDistance respects provided bounds', () =>
    Effect.gen(function* () {
      const min = yield* toViewDistance(4)
      const max = yield* toViewDistance(32)
      const clampedLow = yield* clampViewDistance(1, min, max)
      const clampedHigh = yield* clampViewDistance(128, min, max)

      expect(clampedLow).toBe(4)
      expect(clampedHigh).toBe(32)
    })
  )

  it.effect('toEpochMillis validates non-negative input', () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(toEpochMillis(-5))
      expect(error).toHaveProperty('_tag', 'CalculationFailedError')
    })
  )

  it.effect('deriveCullableFromManaged copies stable fields', () =>
    Effect.gen(function* () {
      const managed = createManagedObject({
        id: 'object-1',
        position: { x: 0, y: 1, z: 2 },
        boundingRadius: 3,
        priority: 0.4,
        lodLevel: 2,
        lastUpdatedAt: 0,
      })
      const timestamp = yield* toEpochMillis(10)
      const cullable = yield* deriveCullableFromManaged(managed, timestamp)

      expect(cullable.id).toBe(managed.id)
      expect(cullable.position).toEqual(managed.position)
      expect(cullable.lastVisibleAt).toBe(timestamp)
    })
  )

  it.effect('createViewControlConfig emits branded values', () =>
    Effect.gen(function* () {
      const config = createViewControlConfig({
        minViewDistance: 4,
        maxViewDistance: 48,
        updateIntervalMillis: 33,
        hysteresis: 0.25,
        adaptiveQuality: true,
      })
      expect(config.minViewDistance).toBe(4)
      expect(config.maxViewDistance).toBe(48)
      expect(config.updateIntervalMillis).toBe(33)
    })
  )

  it.effect('decode functions accept valid inputs', () =>
    Effect.gen(function* () {
      const camera = yield* decodeCameraState(
        createCameraState({
          position: { x: 0, y: 1, z: 2 },
          rotation: { pitch: 0, yaw: 0.2, roll: 0 },
          projection: { type: 'perspective', fov: 70, aspect: 16 / 9, near: 0.1, far: 64 },
        })
      )
      expect(camera.position.z).toBe(2)

      const managed = yield* decodeManagedObject(
        createManagedObject({
          id: 'a',
          position: { x: 1, y: 0, z: 1 },
          boundingRadius: 1,
          priority: 0.3,
          lodLevel: 2,
          lastUpdatedAt: 0,
        })
      )
      expect(managed.lodLevel).toBe(2)

      const cullable = yield* decodeCullableObject(
        createCullableObject({
          id: 'c',
          position: { x: 1, y: 0, z: 1 },
          boundingRadius: 1,
          priority: 0.3,
          lastVisibleAt: 0,
        })
      )
      expect(cullable.lastVisibleAt).toBe(0)

      const metrics = yield* decodePerformanceMetrics(
        createPerformanceMetrics({ frameRate: 60, memoryUsage: 0.4, triangleCount: 120_000 })
      )
      expect(metrics.memoryUsage).toBeCloseTo(0.4, 5)
    })
  )

  it('emptyViewControlResult provides neutral defaults', () => {
    expect(emptyViewControlResult.appliedOptimizations).toHaveLength(0)
    expect(emptyViewControlResult.lodDecisions).toHaveLength(0)
    expect(emptyViewControlResult.frustum.id).toBe('frustum:empty')
  })
})
