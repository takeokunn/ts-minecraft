import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { createCameraState, createManagedObject, createPerformanceMetrics, createViewControlConfig } from '../types'
import { createViewController } from '../view_controller'

describe('view_distance/view_controller', () => {
  const initialConfig = createViewControlConfig({
    minViewDistance: 4,
    maxViewDistance: 32,
    updateIntervalMillis: 30,
    hysteresis: 0.2,
    adaptiveQuality: true,
  })

  const camera = createCameraState({
    position: { x: 0, y: 2, z: 0 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
    projection: { type: 'perspective', fov: 70, aspect: 16 / 9, near: 0.1, far: 96 },
  })

  const context = {
    camera,
    performance: createPerformanceMetrics({ frameRate: 60, memoryUsage: 0.5, triangleCount: 120_000 }),
    sceneComplexity: 0.4,
  }

  const objects = [
    createManagedObject({
      id: 'object-1',
      position: { x: 2, y: 0, z: 2 },
      boundingRadius: 1,
      priority: 0.5,
      lodLevel: 1,
      lastUpdatedAt: 0,
    }),
    createManagedObject({
      id: 'object-2',
      position: { x: 20, y: 0, z: 0 },
      boundingRadius: 1,
      priority: 0.3,
      lodLevel: 3,
      lastUpdatedAt: 0,
    }),
  ]

  it.effect('produces view control result and events', () =>
    Effect.gen(function* () {
      const controller = yield* createViewController(initialConfig)
      const { result, events } = yield* controller.updateViewSystem(context, objects)

      expect(result.frustum.farDistance).toBe(32)
      expect(result.lodDecisions).toHaveLength(objects.length)
      expect(result.cullingDecisions).toHaveLength(objects.length)
      expect(result.appliedOptimizations).toContain('lod-evaluated')
      expect(events).toHaveLength(3)
    })
  )

  it.effect('applies new settings for subsequent updates', () =>
    Effect.gen(function* () {
      const controller = yield* createViewController(initialConfig)
      const updatedConfig = createViewControlConfig({
        minViewDistance: 6,
        maxViewDistance: 48,
        updateIntervalMillis: 20,
        hysteresis: 0.1,
        adaptiveQuality: false,
      })
      yield* controller.applyNewSettings(updatedConfig)
      const { result } = yield* controller.updateViewSystem(context, objects)
      expect(result.frustum.farDistance).toBe(48)
    })
  )
})
