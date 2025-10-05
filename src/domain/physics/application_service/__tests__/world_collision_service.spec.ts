import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { CollisionServiceLive } from '../../domain_service/collision_service'
import { aabb, vector3, PhysicsWorldId } from '../../types/core'
import { WorldCollisionApplicationService, WorldCollisionApplicationServiceLive } from '../world_collision_service'

describe('WorldCollisionApplicationService', () => {
  const layer = Layer.mergeAll(CollisionServiceLive, WorldCollisionApplicationServiceLive)
  const shape = aabb({
    min: vector3({ x: 0, y: 0, z: 0 }),
    max: vector3({ x: 1, y: 2, z: 1 }),
  })
  const worldId = PhysicsWorldId('world-12345678')

  it.effect('allows placement when no collision is detected', () =>
    Effect.gen(function* () {
      const service = yield* WorldCollisionApplicationService
      const canPlace = yield* service.canPlaceBlock({
        worldId,
        shape,
        position: vector3({ x: 0, y: 0, z: 0 }),
        sample: () => [],
      })

      expect(canPlace).toBe(true)
    }).pipe(Effect.provide(layer))
  )

  it.effect('simulates movement and reports grounding when collisions occur', () =>
    Effect.gen(function* () {
      const service = yield* WorldCollisionApplicationService
      const context = {
        worldId,
        shape,
        position: vector3({ x: 0, y: 2, z: 0 }),
        velocity: vector3({ x: 0, y: -5, z: 0 }),
        deltaTime: 0.5,
        sample: () => [shape],
      }

      const result = yield* service.simulateMovement(context)

      expect(result.grounded).toBe(true)
      expect(result.position).toEqual(context.position)
    }).pipe(Effect.provide(layer))
  )

  it.effect('placement fails when sample contains overlapping geometry', () =>
    Effect.gen(function* () {
      const service = yield* WorldCollisionApplicationService
      const canPlace = yield* service.canPlaceBlock({
        worldId,
        shape,
        position: vector3({ x: 3, y: 0, z: 0 }),
        sample: (query) => [query],
      })

      expect(canPlace).toBe(false)
    }).pipe(Effect.provide(layer))
  )
})
