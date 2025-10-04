import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { describe, expect } from 'vitest'
import * as fc from 'effect/FastCheck'
import { CollisionService, CollisionServiceLive } from '../collision_service'
import { aabb, vector3 } from '../../types/core'
import { provideLayers } from '../../../../testing/effect'

describe('CollisionService', () => {
  const layer = CollisionServiceLive
  const shape = aabb({
    min: vector3({ x: 0, y: 0, z: 0 }),
    max: vector3({ x: 1, y: 2, z: 1 }),
  })

  it.effect('detects collision', () =>
    provideLayers(
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
      }),
      layer
    )
  )

  // TODO: プロパティテストの高速化後にskipを解除する
  it.effect.skip('free space yields no collision', () => Effect.unit)
})
