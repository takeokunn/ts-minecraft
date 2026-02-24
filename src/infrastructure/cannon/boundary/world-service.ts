import { Effect, Context, Layer } from 'effect'
import * as CANNON from 'cannon-es'
import type { Vector3 } from '@/infrastructure/cannon/core/vector3'

export type WorldConfig = {
  readonly gravity: Vector3
  readonly broadphase: 'naive' | 'sap'
}

export interface PhysicsWorldService {
  readonly create: (config: WorldConfig) => Effect.Effect<CANNON.World, never>
  readonly addBody: (world: CANNON.World, body: CANNON.Body) => Effect.Effect<void, never>
  readonly removeBody: (world: CANNON.World, body: CANNON.Body) => Effect.Effect<void, never>
  readonly step: (world: CANNON.World, deltaTime: number) => Effect.Effect<void, never>
}

export const PhysicsWorldService = Context.GenericTag<PhysicsWorldService>(
  '@minecraft/infrastructure/cannon/PhysicsWorldService',
)

export const PhysicsWorldServiceLive = Layer.succeed(
  PhysicsWorldService,
  PhysicsWorldService.of({
    create: (config) =>
      Effect.sync(() => {
        const world = new CANNON.World()
        world.gravity.set(config.gravity.x, config.gravity.y, config.gravity.z)
        if (config.broadphase === 'sap') {
          world.broadphase = new CANNON.SAPBroadphase(world)
        }
        return world
      }),
    addBody: (world, body) =>
      Effect.sync(() => world.addBody(body)),
    removeBody: (world, body) =>
      Effect.sync(() => world.removeBody(body)),
    step: (world, deltaTime) =>
      Effect.sync(() => world.step(deltaTime)),
  }),
)
