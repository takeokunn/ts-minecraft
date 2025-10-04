import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { describe, expect } from 'vitest'
import * as fc from 'effect/FastCheck'
import {
  PhysicsSimulationOrchestratorService,
  PhysicsSimulationOrchestratorServiceLive,
} from '../physics_simulation_orchestrator'
import { RigidBodyAggregate } from '../../aggregate/rigid_body'
import { aabb, vector3 } from '../../types/core'
import { CollisionServiceLive } from '../../domain_service/collision_service'
import { PhysicsSimulationServiceLive } from '../../domain_service/physics_simulation_service'

describe('PhysicsSimulationOrchestratorService', () => {
  const layer = Layer.mergeAll(
    CollisionServiceLive,
    PhysicsSimulationServiceLive,
    PhysicsSimulationOrchestratorServiceLive
  )

  it.effect('steps world with single body', () =>
    Effect.gen(function* () {
      const orchestrator = yield* PhysicsSimulationOrchestratorService
      const world = yield* orchestrator.createWorld()
      const body = yield* RigidBodyAggregate.create({
        worldId: world.id,
        entityId: 'entity-1',
        bodyType: 'dynamic',
        material: 'stone',
        mass: 70,
        position: vector3({ x: 0, y: 5, z: 0 }),
      })
      const results = yield* orchestrator.stepWorld(world.id, [body], {
        deltaTime: 0.2,
        sampleBlocks: () => [
          aabb({
            min: vector3({ x: -1, y: 0, z: -1 }),
            max: vector3({ x: 1, y: 0.1, z: 1 }),
          }),
        ],
        bodyShape: () =>
          aabb({
            min: vector3({ x: -0.3, y: 0, z: -0.3 }),
            max: vector3({ x: 0.3, y: 1.8, z: 0.3 }),
          }),
        inputVelocity: () => vector3({ x: 0, y: 0, z: 0 }),
        headBlock: () => 0,
        feetBlock: () => 1,
        headLevel: 1,
        feetLevel: 0,
      })
      expect(results.length).toBe(1)
    }).pipe(Effect.provideLayer(layer))
  )

  it.effect.prop('handles various delta times', [fc.float({ min: 0.05, max: 0.2 })], ([dt]) =>
    Effect.gen(function* () {
      const orchestrator = yield* PhysicsSimulationOrchestratorService
      const world = yield* orchestrator.createWorld()
      const body = yield* RigidBodyAggregate.create({
        worldId: world.id,
        entityId: 'entity-2',
        bodyType: 'dynamic',
        material: 'stone',
        mass: 65,
        position: vector3({ x: 0, y: 5, z: 0 }),
      })
      const results = yield* orchestrator.stepWorld(world.id, [body], {
        deltaTime: dt,
        sampleBlocks: () => [],
        bodyShape: () =>
          aabb({
            min: vector3({ x: -0.3, y: 0, z: -0.3 }),
            max: vector3({ x: 0.3, y: 1.8, z: 0.3 }),
          }),
        inputVelocity: () => vector3({ x: 0, y: 0, z: 0 }),
        headBlock: () => 0,
        feetBlock: () => 0,
        headLevel: 0,
        feetLevel: 0,
      })
      expect(results[0]?.velocity).toBeDefined()
    }).pipe(Effect.provideLayer(layer))
  )
})
