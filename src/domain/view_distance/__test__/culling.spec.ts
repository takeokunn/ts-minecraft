import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { createViewFrustum } from '../frustum.js'
import { createCullingStrategy } from '../culling.js'
import {
  createCameraState,
  createCullableObject,
  toViewDistance,
  toEpochMillis,
  deriveCullableFromManaged,
  createManagedObject,
} from '../types.js'

describe('view_distance/culling', () => {
  const camera = createCameraState({
    position: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
    projection: { type: 'perspective', fov: 75, aspect: 16 / 9, near: 0.1, far: 256 },
  })

  const strategy = createCullingStrategy()

  it.effect('marks nearby objects as visible', () =>
    Effect.gen(function* () {
      const viewDistance = yield* toViewDistance(32)
      const frustum = yield* createViewFrustum(camera, viewDistance)
      const timestamp = yield* toEpochMillis(100)
      const managed = createManagedObject({
        id: 'near-object',
        position: { x: 1, y: 0, z: 1 },
        boundingRadius: 1,
        priority: 0.5,
        lodLevel: 1,
        lastUpdatedAt: 0,
      })
      const cullable = yield* deriveCullableFromManaged(managed, timestamp)
      const [decision] = yield* strategy.cull([cullable], frustum)
      expect(decision.visible).toBe(true)
      expect(decision.reason).toBe('visible')
    })
  )

  it.effect('filters objects outside radius', () =>
    Effect.gen(function* () {
      const viewDistance = yield* toViewDistance(16)
      const frustum = yield* createViewFrustum(camera, viewDistance)
      const farObject = createCullableObject({
        id: 'far-object',
        position: { x: 0, y: 0, z: 40 },
        boundingRadius: 2,
        priority: 0.4,
        lastVisibleAt: 0,
      })
      const [decision] = yield* strategy.cull([farObject], frustum)
      expect(decision.visible).toBe(false)
      expect(decision.reason).toBe('outside-frustum')
    })
  )
})
