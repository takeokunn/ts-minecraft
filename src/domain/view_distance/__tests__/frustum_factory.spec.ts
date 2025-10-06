import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { createViewDistanceToolkit } from '../frustum_factory'
import { createCameraState, createViewControlConfig } from '../types'

const baseCamera = createCameraState({
  position: { x: 0, y: 0, z: 0 },
  rotation: { pitch: 0, yaw: 0, roll: 0 },
  projection: { type: 'perspective', fov: 70, aspect: 16 / 9, near: 0.1, far: 120 },
})

const initialConfig = createViewControlConfig({
  minViewDistance: 6,
  maxViewDistance: 48,
  updateIntervalMillis: 25,
  hysteresis: 0.15,
  adaptiveQuality: true,
})

describe('view_distance/frustum_factory', () => {
  it.effect('creates toolkit with functioning services', () =>
    Effect.gen(function* () {
      const toolkit = yield* createViewDistanceToolkit(initialConfig)
      const frustum = yield* toolkit.computeFrustum(baseCamera, initialConfig.maxViewDistance)
      expect(frustum.farDistance).toBe(48)
      const context = yield* toolkit.buildLODContext(
        {
          camera: baseCamera,
          performance: {
            frameRate: 60,
            memoryUsage: 0.5,
            triangleCount: 100_000,
          },
          sceneComplexity: 0.4,
        },
        []
      )
      expect(context.maxViewDistance).toBe(48)
      expect(toolkit.lodSelector).toBeDefined()
      expect(toolkit.cullingStrategy).toBeDefined()
    })
  )

  it.effect('buildLODContext reflects persisted settings', () =>
    Effect.gen(function* () {
      const toolkit = yield* createViewDistanceToolkit(initialConfig)
      const updatedConfig = createViewControlConfig({
        minViewDistance: 8,
        maxViewDistance: 32,
        updateIntervalMillis: 16,
        hysteresis: 0.1,
        adaptiveQuality: false,
      })
      yield* toolkit.settingsRepository.save(updatedConfig)
      const context = yield* toolkit.buildLODContext(
        {
          camera: baseCamera,
          performance: {
            frameRate: 45,
            memoryUsage: 0.6,
            triangleCount: 80_000,
          },
          sceneComplexity: 0.5,
        },
        []
      )
      expect(context.maxViewDistance).toBe(32)
    })
  )
})
