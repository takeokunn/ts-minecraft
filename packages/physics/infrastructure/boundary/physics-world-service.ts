import { Array as Arr, Effect } from 'effect'
import type { CustomBody } from '../../domain/physics-body'
import type { CustomWorld, WorldConfig } from '../../domain/physics-world'
import type { DeltaTimeSecs } from '@ts-minecraft/kernel'

export class PhysicsWorldService extends Effect.Service<PhysicsWorldService>()(
  '@minecraft/infrastructure/physics/PhysicsWorldService',
  {
    succeed: {
      create: (config: WorldConfig): Effect.Effect<CustomWorld, never> =>
        Effect.succeed({
          gravity: { x: config.gravity.x, y: config.gravity.y, z: config.gravity.z },
          bodies: [],
        }),
      addBody: (world: CustomWorld, body: CustomBody): Effect.Effect<void, never> =>
        Effect.sync(() => {
          world.bodies = Arr.append(world.bodies, body)
        }),
      removeBody: (world: CustomWorld, body: CustomBody): Effect.Effect<void, never> =>
        Effect.sync(() => {
          world.bodies = Arr.filter(world.bodies, (b) => b !== body)
        }),
      step: (world: CustomWorld, deltaTime: DeltaTimeSecs): Effect.Effect<void, never> =>
        Effect.sync(() => {
          Arr.forEach(world.bodies, (body) => {
            if (body.type !== 'dynamic') return

            // Euler integration with gravity
            body.velocity.y += world.gravity.y * deltaTime
            body.position.x += body.velocity.x * deltaTime
            body.position.y += body.velocity.y * deltaTime
            body.position.z += body.velocity.z * deltaTime
          })
        }),
    },
  }
) {}
export const PhysicsWorldServiceLive = PhysicsWorldService.Default
