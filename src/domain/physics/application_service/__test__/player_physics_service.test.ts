import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { describe, expect } from 'vitest'
import * as fc from 'effect/FastCheck'
import { PlayerPhysicsApplicationService, PlayerPhysicsApplicationServiceLive } from '../player_physics_service'
import { CollisionServiceLive } from '../../domain_service/collision_service'
import { PhysicsSimulationServiceLive } from '../../domain_service/physics_simulation_service'
import { PhysicsWorldAggregate } from '../../aggregate/physics_world'
import { RigidBodyAggregate } from '../../aggregate/rigid_body'
import { aabb, vector3 } from '../../types/core'

describe('PlayerPhysicsApplicationService', () => {
  const layer = Layer.mergeAll(CollisionServiceLive, PhysicsSimulationServiceLive, PlayerPhysicsApplicationServiceLive)

  it.effect('steps player body', () =>
    Effect.gen(function* () {
      const world = yield* PhysicsWorldAggregate.create({})
      const body = yield* RigidBodyAggregate.create({
        worldId: world.id,
        entityId: 'player',
        bodyType: 'dynamic',
        material: 'stone',
        mass: 70,
        position: vector3({ x: 0, y: 5, z: 0 }),
      })
      const service = yield* PlayerPhysicsApplicationService
      const updated = yield* service.step({
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
      expect(updated.motion.position.y).toBeLessThan(body.motion.position.y)
    }).pipe(Effect.provideLayer(layer))
  )

  it.effect.prop('responds to input velocity', [fc.float({ min: -1, max: 1 })], ([vx]) =>
    Effect.gen(function* () {
      const world = yield* PhysicsWorldAggregate.create({})
      const body = yield* RigidBodyAggregate.create({
        worldId: world.id,
        entityId: 'player',
        bodyType: 'dynamic',
        material: 'stone',
        mass: 70,
        position: vector3({ x: 0, y: 5, z: 0 }),
      })
      const service = yield* PlayerPhysicsApplicationService
      const updated = yield* service.step({
        world,
        body,
        bodyShape: aabb({
          min: vector3({ x: -0.3, y: 0, z: -0.3 }),
          max: vector3({ x: 0.3, y: 1.8, z: 0.3 }),
        }),
        inputVelocity: vector3({ x: vx, y: 0, z: 0 }),
        deltaTime: 0.1,
        sampleBlocks: () => [],
        headBlock: 0,
        feetBlock: 0,
        headLevel: 0,
        feetLevel: 0,
      })
      expect(updated.motion.velocity.x).toBeCloseTo(vx)
    }).pipe(Effect.provideLayer(layer))
  )
})
