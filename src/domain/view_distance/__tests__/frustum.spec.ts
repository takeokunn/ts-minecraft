import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import {
  createViewFrustum,
  frustumComputedEvent,
  isWithinFrustum,
  summarizeFrustum,
  updateViewFrustum,
} from '../frustum.js'
import { createCameraState, toViewDistance } from '../types.js'

describe('view_distance/frustum', () => {
  const baseCamera = createCameraState({
    position: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
    projection: { type: 'perspective', fov: 70, aspect: 16 / 9, near: 0.1, far: 128 },
  })

  it.effect('createViewFrustum derives bounded far distance', () =>
    Effect.gen(function* () {
      const viewDistance = yield* toViewDistance(32)
      const frustum = yield* createViewFrustum(baseCamera, viewDistance)

      expect(frustum.farDistance).toBe(32)
      expect(frustum.nearDistance).toBeCloseTo(0.1, 5)
      expect(frustum.radiusSquared).toBeCloseTo(32 * 32, 5)
    })
  )

  it.effect('createViewFrustum fails when projection near exceeds view distance', () =>
    Effect.gen(function* () {
      const problematicCamera = createCameraState({
        position: { x: 0, y: 0, z: 0 },
        rotation: { pitch: 0, yaw: 0, roll: 0 },
        projection: { type: 'perspective', fov: 60, aspect: 1.6, near: 4, far: 6 },
      })
      const viewDistance = yield* toViewDistance(2)
      const error = yield* Effect.flip(createViewFrustum(problematicCamera, viewDistance))
      expect(error).toHaveProperty('_tag', 'InvalidConfigurationError')
    })
  )

  it.effect('updateViewFrustum preserves identifier', () =>
    Effect.gen(function* () {
      const viewDistance = yield* toViewDistance(48)
      const initial = yield* createViewFrustum(baseCamera, viewDistance)
      const movedCamera = createCameraState({
        position: { x: 10, y: 0, z: 0 },
        rotation: { pitch: 0, yaw: Math.PI / 6, roll: 0 },
        projection: { type: 'perspective', fov: 80, aspect: 16 / 9, near: 0.2, far: 256 },
      })

      const updated = yield* updateViewFrustum(initial, movedCamera, viewDistance)
      expect(updated.id).toBe(initial.id)
      expect(updated.camera.position.x).toBe(10)
      expect(updated.farDistance).toBe(48)
    })
  )

  it.effect('summarizeFrustum and frustumComputedEvent provide metadata', () =>
    Effect.gen(function* () {
      const viewDistance = yield* toViewDistance(24)
      const frustum = yield* createViewFrustum(baseCamera, viewDistance)
      const summary = yield* summarizeFrustum(frustum)
      expect(summary.id).toBe(frustum.id)
      expect(summary.farDistance).toBe(24)

      const event = yield* frustumComputedEvent(frustum)
      expect(event.summary.id).toBe(frustum.id)
    })
  )

  it('isWithinFrustum checks Euclidean distance', () => {
    const viewDistance = Effect.runSync(toViewDistance(10))
    const frustum = Effect.runSync(createViewFrustum(baseCamera, viewDistance))
    expect(isWithinFrustum(frustum, { x: 0, y: 0, z: 5 })).toBe(true)
    expect(isWithinFrustum(frustum, { x: 0, y: 0, z: 12 })).toBe(false)
  })
})
