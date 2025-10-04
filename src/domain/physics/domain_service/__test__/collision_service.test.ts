import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { describe, expect } from 'vitest'
import * as fc from 'effect/FastCheck'
import { CollisionService, CollisionServiceLive } from '../collision_service'
import { aabb, vector3 } from '../../types/core'

describe('CollisionService', () => {
  const layer = CollisionServiceLive
  const shape = aabb({
    min: vector3({ x: 0, y: 0, z: 0 }),
    max: vector3({ x: 1, y: 2, z: 1 }),
  })

  it.effect('detects collision', () =>
    Effect.gen(function* () {
      const service = yield* CollisionService
      const result = yield* service.detect({
        worldId: 'world-1',
        body: shape,
        position: vector3({ x: 0, y: 5, z: 0 }),
        velocity: vector3({ x: 0, y: -10, z: 0 }),
        deltaTime: 0.2,
        sample: () => [
          aabb({
            min: vector3({ x: 0, y: 0, z: 0 }),
            max: vector3({ x: 1, y: 1, z: 1 }),
          }),
        ],
      })
      expect(result.collidedAxes.y).toBe(true)
    }).pipe(Effect.provideLayer(layer))
  )

  it.effect.prop('free space yields no collision', [fc.float({ min: -5, max: 5 })], ([vy]) =>
    Effect.gen(function* () {
      const service = yield* CollisionService
      const result = yield* service.detect({
        worldId: 'world-1',
        body: shape,
        position: vector3({ x: 0, y: 5, z: 0 }),
        velocity: vector3({ x: 0, y: vy, z: 0 }),
        deltaTime: 0.1,
        sample: () => [],
      })
      expect(result.collidedAxes.x || result.collidedAxes.y || result.collidedAxes.z).toBe(false)
    }).pipe(Effect.provideLayer(layer))
  )
})
