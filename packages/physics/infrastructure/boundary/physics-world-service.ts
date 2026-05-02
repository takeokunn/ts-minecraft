import { Array as Arr, Effect } from 'effect'
import type { CustomBody, CustomWorld, WorldConfig } from '../../domain/physics-port'
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
          const dt = deltaTime

          // Integrate dynamic bodies
          Arr.forEach(world.bodies, (body) => {
            if (body.type !== 'dynamic') return

            // Apply gravity
            body.velocity.y += world.gravity.y * dt

            // Euler integration
            body.position.x += body.velocity.x * dt
            body.position.y += body.velocity.y * dt
            body.position.z += body.velocity.z * dt

          })
        }),
    },
  }
) {}
export const PhysicsWorldServiceLive = PhysicsWorldService.Default
