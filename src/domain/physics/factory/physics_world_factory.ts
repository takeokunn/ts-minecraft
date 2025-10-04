import type { PhysicsConfig, PhysicsWorld, Vector3 } from '../types/core'
import { PhysicsWorldAggregate } from '../aggregate/physics_world'
import type { PhysicsError } from '../types/errors'

export interface WorldCreationOptions {
  readonly config?: Partial<PhysicsConfig>
  readonly gravity?: Vector3
}

export const PhysicsWorldFactory = {
  create: (options: WorldCreationOptions = {}): Effect.Effect<PhysicsWorld, PhysicsError> =>
    PhysicsWorldAggregate.create(options),
  start: (world: PhysicsWorld): Effect.Effect<PhysicsWorld, PhysicsError> => PhysicsWorldAggregate.start(world),
  stop: (world: PhysicsWorld): Effect.Effect<PhysicsWorld, PhysicsError> => PhysicsWorldAggregate.stop(world),
  step: (
    world: PhysicsWorld,
    deltaTime: number,
    activeBodies: number
  ): Effect.Effect<PhysicsWorld, PhysicsError> => PhysicsWorldAggregate.step(world, deltaTime, activeBodies),
}
