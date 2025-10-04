import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { describe, expect } from 'vitest'
import * as fc from 'effect/FastCheck'
import { WorldCollisionApplicationService, WorldCollisionApplicationServiceLive } from '../world_collision_service'
import { CollisionServiceLive } from '../../domain_service/collision_service'
import { aabb, vector3 } from '../../types/core'

describe('WorldCollisionApplicationService', () => {
  const layer = Layer.mergeAll(CollisionServiceLive, WorldCollisionApplicationServiceLive)
  const shape = aabb({
    min: vector3({ x: 0, y: 0, z: 0 }),
    max: vector3({ x: 1, y: 2, z: 1 }),
  })

  it.effect('checks placement', () =>
    Effect.gen(function* () {
      const service = yield* WorldCollisionApplicationService
      const canPlace = yield* service.canPlaceBlock({
        worldId: 'world-1',
        shape,
        position: vector3({ x: 0, y: 5, z: 0 }),
        sample: () => [],
      })
      expect(canPlace).toBe(true)
    }).pipe(Effect.provideLayer(layer))
  )

  it.effect('simulates movement', () =>
    Effect.gen(function* () {
      const service = yield* WorldCollisionApplicationService
      const result = yield* service.simulateMovement({
        worldId: 'world-1',
        shape,
        position: vector3({ x: 0, y: 5, z: 0 }),
        velocity: vector3({ x: 0, y: -5, z: 0 }),
        deltaTime: 0.2,
        sample: () => [
          aabb({
            min: vector3({ x: -1, y: 0, z: -1 }),
            max: vector3({ x: 1, y: 0.1, z: 1 }),
          }),
        ],
      })
      expect(result.position.y).toBeLessThanOrEqual(5)
    }).pipe(Effect.provideLayer(layer))
  )

  it.effect.prop('placement fails when block overlaps', [fc.float({ min: -1, max: 1 })], ([offsetY]) =>
    Effect.gen(function* () {
      const service = yield* WorldCollisionApplicationService
      const canPlace = yield* service.canPlaceBlock({
        worldId: 'world-1',
        shape,
        position: vector3({ x: 0, y: offsetY, z: 0 }),
        sample: () => [
          aabb({
            min: vector3({ x: 0, y: offsetY, z: 0 }),
            max: vector3({ x: 1, y: offsetY + 1, z: 1 }),
          }),
        ],
      })
      expect(canPlace).toBe(false)
    }).pipe(Effect.provideLayer(layer))
  )
})
