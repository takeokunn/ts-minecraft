import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { describe, expect } from 'vitest'
import { Layer } from 'effect'
import { PhysicsSimulationService, PhysicsSimulationServiceLive } from '../physics_simulation_service'
import { PhysicsWorldAggregate } from '../../aggregate/physics_world'
import { RigidBodyAggregate } from '../../aggregate/rigid_body'
import { aabb, vector3 } from '../../types/core'
import { CollisionServiceLive } from '../collision_service'
import * as fc from 'effect/FastCheck'

describe('PhysicsSimulationService', () => {
  const layer = Layer.mergeAll(CollisionServiceLive, PhysicsSimulationServiceLive)

  it.effect('simulates falling body', () =>
    Effect.gen(function* () {
      const world = yield* PhysicsWorldAggregate.create({})
      const body = yield* RigidBodyAggregate.create({
        worldId: world.id,
        entityId: 'player-1',
        bodyType: 'dynamic',
        material: 'stone',
        mass: 80,
        position: vector3({ x: 0, y: 5, z: 0 }),
      })
      const service = yield* PhysicsSimulationService
      const result = yield* service.simulate({
        world,
        body,
        bodyShape: aabb({
          min: vector3({ x: -0.3, y: 0, z: -0.3 }),
          max: vector3({ x: 0.3, y: 1.8, z: 0.3 }),
        }),
        inputVelocity: vector3({ x: 0, y: 0, z: 0 }),
        deltaTime: 0.2,
        sampleBlocks: () => [
          aabb({
            min: vector3({ x: -1, y: 0, z: -1 }),
            max: vector3({ x: 1, y: 0.1, z: 1 }),
          }),
        ],
        headBlock: 0,
        feetBlock: 1,
        headLevel: 1,
        feetLevel: 0,
      })
      expect(result.velocity.y).toBeLessThanOrEqual(0)
    }).pipe(Effect.provideLayer(layer))
  )
})

  it.effect.prop('gravity accelerates downward', [fc.float({ min: 0.05, max: 0.2 })], ([dt]) =>
    Effect.gen(function* () {
      const world = yield* PhysicsWorldAggregate.create({})
      const body = yield* RigidBodyAggregate.create({
        worldId: world.id,
        entityId: 'entity',
        bodyType: 'dynamic',
        material: 'stone',
        mass: 70,
        position: vector3({ x: 0, y: 5, z: 0 }),
      })
      const service = yield* PhysicsSimulationService
      const result = yield* service.simulate({
        world,
        body,
        bodyShape: aabb({
          min: vector3({ x: -0.5, y: 0, z: -0.5 }),
          max: vector3({ x: 0.5, y: 1.8, z: 0.5 }),
        }),
        inputVelocity: vector3({ x: 0, y: 0, z: 0 }),
        deltaTime: dt,
        sampleBlocks: () => [],
        headBlock: 0,
        feetBlock: 0,
        headLevel: 0,
        feetLevel: 0,
      })
      expect(result.velocity.y).toBeLessThanOrEqual(body.motion.velocity.y)
    }).pipe(Effect.provideLayer(layer))
  )
