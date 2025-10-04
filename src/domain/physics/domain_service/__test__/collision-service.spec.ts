import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { describe, expect } from 'vitest'
import * as fc from 'effect/FastCheck'
import { CollisionService, CollisionServiceLive } from '../collision-service'
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

  it.effect('free space yields no collision', () =>
    provideLayers(
      Effect.gen(function* () {
        const service = yield* CollisionService
        const position = vector3({ x: 0, y: 10, z: 0 })
        const velocity = vector3({ x: 0, y: -5, z: 0 })
        const deltaTime = 0.4
        const result = yield* service.detect({
          worldId: 'world-empty',
          body: shape,
          position,
          velocity,
          deltaTime,
          sample: () => [],
        })

        expect(result.collidedAxes).toStrictEqual({ x: false, y: false, z: false })
        expect(result.isGrounded).toBe(false)
        expect(result.velocity).toStrictEqual(velocity)
        expect(result.position).toStrictEqual(
          vector3({
            x: position.x + velocity.x * deltaTime,
            y: position.y + velocity.y * deltaTime,
            z: position.z + velocity.z * deltaTime,
          })
        )
        expect(result.contactNormal).toStrictEqual(vector3({ x: 0, y: 0, z: 0 }))
        expect(result.penetration).toBe(0)
      }),
      layer
    )
  )
})
