import { Array as Arr, Effect, Match, Option, Schema } from 'effect'
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
          Option.map(Arr.findFirstIndex(world.bodies, (b) => b === body), (idx) => world.bodies.splice(idx, 1))
        }),
      step: (world: CustomWorld, deltaTime: DeltaTimeSecs): Effect.Effect<void, never> =>
        Effect.sync(() => {
          const dt = deltaTime as number

          // Find all static plane bodies (for collision resolution)
          const planeYValues = Arr.filterMap(world.bodies, (body) =>
            body.type === 'static' && body.shape.kind === 'plane'
              ? Option.some(body.position.y)
              : Option.none()
          )

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
            Arr.forEach(planeYValues, (planeY) => {
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
