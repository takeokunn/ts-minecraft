import { Array as Arr, Effect, Match, Option, Schema } from 'effect'
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
    staticPlaneYs: Schema.mutable(Schema.Array(Schema.Number)),
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
          staticPlaneYs: [],
        }),
      addBody: (world: CustomWorld, body: CustomBody): Effect.Effect<void, never> =>
        Effect.sync(() => {
          world.bodies = Arr.append(world.bodies, body)
          if (body.type === 'static' && body.shape.kind === 'plane') {
            world.staticPlaneYs = Arr.append(world.staticPlaneYs, body.position.y)
          }
        }),
      removeBody: (world: CustomWorld, body: CustomBody): Effect.Effect<void, never> =>
        Effect.sync(() => {
          world.bodies = Arr.filter(world.bodies, (b) => b !== body)
          if (body.type === 'static' && body.shape.kind === 'plane') {
            const planeIndex = world.staticPlaneYs.indexOf(body.position.y)
            if (planeIndex >= 0) {
              world.staticPlaneYs = [
                ...world.staticPlaneYs.slice(0, planeIndex),
                ...world.staticPlaneYs.slice(planeIndex + 1),
              ]
            }
          }
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

            // AABB-vs-plane collision resolution
            Arr.forEach(world.staticPlaneYs, (planeY) => {
              const bodyBottomYOpt = Match.value(body.shape).pipe(
                Match.when({ kind: 'box' }, (shape) => Option.some(body.position.y - shape.halfExtents.y)),
                Match.when({ kind: 'sphere' }, (shape) => Option.some(body.position.y - shape.radius)),
                Match.when({ kind: 'plane' }, () => Option.none<number>()),
                Match.exhaustive
              )
              Option.map(bodyBottomYOpt, (bodyBottomY) => {
                if (bodyBottomY < planeY) {
                  Match.value(body.shape).pipe(
                    Match.when({ kind: 'box' }, (shape): void => { body.position.y = planeY + shape.halfExtents.y }),
                    Match.when({ kind: 'sphere' }, (shape): void => { body.position.y = planeY + shape.radius }),
                    Match.when({ kind: 'plane' }, (): void => {}),
                    Match.exhaustive
                  )
                  if (body.velocity.y < 0) body.velocity.y = 0
                }
              })
            })
          })
        }),
    },
  }
) {}
export const PhysicsWorldServiceLive = PhysicsWorldService.Default
