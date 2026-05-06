import { Effect } from 'effect'
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
          world.bodies.push(body)
        }),
      removeBody: (world: CustomWorld, body: CustomBody): Effect.Effect<void, never> =>
        Effect.sync(() => {
          for (let index = world.bodies.length - 1; index >= 0; index -= 1) {
            if (world.bodies[index] === body) {
              world.bodies.splice(index, 1)
            }
          }
        }),
      step: (world: CustomWorld, deltaTime: DeltaTimeSecs): Effect.Effect<void, never> =>
        Effect.sync(() => {
          const gravityY = world.gravity.y
          for (const body of world.bodies) {
            if (body.type !== 'dynamic') continue

            body.velocity.y += gravityY * deltaTime
            body.position.x += body.velocity.x * deltaTime
            body.position.y += body.velocity.y * deltaTime
            body.position.z += body.velocity.z * deltaTime
          }
        }),
    },
  }
) {}
export const PhysicsWorldServiceLive = PhysicsWorldService.Default
