import { Array as Arr, Effect, Schema } from 'effect'
import { CustomBodySchema, type CustomBody } from './rigid-body-service'
import { Vector3Schema } from '@/infrastructure/physics/core'
import type { DeltaTimeSecs } from '@/shared/kernel'

export const WorldConfigSchema = Schema.Struct({
  gravity: Vector3Schema,
  broadphase: Schema.Literal('naive', 'sap'),
})
export type WorldConfig = Schema.Schema.Type<typeof WorldConfigSchema>

export const CustomWorldSchema = Schema.mutable(
  Schema.Struct({
    gravity: Vector3Schema,
    bodies: Schema.mutable(Schema.Array(CustomBodySchema)),
  }),
)
export type CustomWorld = Schema.Schema.Type<typeof CustomWorldSchema>

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
