import { Effect, Schema } from 'effect'
import type { CustomBody } from './rigid-body-service'
import { Vector3Schema } from '@/infrastructure/physics/core'
import type { DeltaTimeSecs } from '@/shared/kernel'

export const WorldConfigSchema = Schema.Struct({
  gravity: Vector3Schema,
  broadphase: Schema.Literal('naive', 'sap'),
})
export type WorldConfig = Schema.Schema.Type<typeof WorldConfigSchema>

export type CustomWorld = {
  gravity: { x: number; y: number; z: number }
  bodies: CustomBody[]
}

export class PhysicsWorldService extends Effect.Service<PhysicsWorldService>()(
  '@minecraft/infrastructure/physics/PhysicsWorldService',
  {
    succeed: {
      create: (config: WorldConfig): Effect.Effect<CustomWorld, never> =>
        Effect.sync(() => ({
          gravity: { x: config.gravity.x, y: config.gravity.y, z: config.gravity.z },
          bodies: [],
        })),
      addBody: (world: CustomWorld, body: CustomBody): Effect.Effect<void, never> =>
        Effect.sync(() => {
          world.bodies.push(body)
        }),
      removeBody: (world: CustomWorld, body: CustomBody): Effect.Effect<void, never> =>
        Effect.sync(() => {
          const idx = world.bodies.indexOf(body)
          if (idx !== -1) world.bodies.splice(idx, 1)
        }),
      step: (world: CustomWorld, deltaTime: DeltaTimeSecs): Effect.Effect<void, never> =>
        Effect.sync(() => {
          const dt = deltaTime as number

          // Find all static plane bodies (for collision resolution)
          const planeYValues: number[] = []
          for (const body of world.bodies) {
            if (body.type === 'static' && body.shape.kind === 'plane') {
              planeYValues.push(body.position.y)
            }
          }

          // Integrate dynamic bodies
          for (const body of world.bodies) {
            if (body.type !== 'dynamic') continue

            // Apply gravity
            body.velocity.y += world.gravity.y * dt

            // Euler integration
            body.position.x += body.velocity.x * dt
            body.position.y += body.velocity.y * dt
            body.position.z += body.velocity.z * dt

            // AABB-vs-plane collision resolution
            for (const planeY of planeYValues) {
              let bodyBottomY: number
              if (body.shape.kind === 'box') {
                bodyBottomY = body.position.y - body.shape.halfExtents.y
              } else if (body.shape.kind === 'sphere') {
                bodyBottomY = body.position.y - body.shape.radius
              } else {
                continue
              }

              if (bodyBottomY < planeY) {
                if (body.shape.kind === 'box') {
                  body.position.y = planeY + body.shape.halfExtents.y
                } else if (body.shape.kind === 'sphere') {
                  body.position.y = planeY + body.shape.radius
                }
                if (body.velocity.y < 0) body.velocity.y = 0
              }
            }
          }
        }),
    },
  }
) {}
export const PhysicsWorldServiceLive = PhysicsWorldService.Default
