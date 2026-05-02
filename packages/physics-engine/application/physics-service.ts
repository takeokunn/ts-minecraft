import { Effect, Match, Option, Ref, Data, Schema, HashMap } from 'effect'
import { PhysicsBodyId, PhysicsBodyIdSchema, Position, PositionSchema, DeltaTimeSecs } from '@ts-minecraft/kernel'
import { Vector3Schema, type Vector3 } from '@ts-minecraft/kernel'
import {
  PhysicsWorldPort,
  RigidBodyPort,
  ShapePort,
  type CustomBody,
  type CustomWorld,
  type CustomShape,
} from '../domain/physics-port'

// Distinct _tag 'PhysicsServiceError' avoids collision with domain-level PhysicsError in domain/errors.ts.
export class PhysicsServiceError extends Data.TaggedError('PhysicsServiceError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return this.cause
      ? `Physics error [${this.operation}]: ${String(this.cause)}`
      : `Physics error [${this.operation}]`
  }
}

export const PhysicsBodySchema = Schema.Struct({ id: PhysicsBodyIdSchema })
export type PhysicsBody = Schema.Schema.Type<typeof PhysicsBodySchema>

const ShapeParamsSchema = Schema.Struct({
  halfExtents: Schema.optional(Vector3Schema),
  radius: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.positive())),
})

export const AddBodyConfigSchema = Schema.Struct({
  mass: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  position: PositionSchema,
  shape: Schema.Literal('box', 'sphere', 'plane'),
  shapeParams: Schema.optional(ShapeParamsSchema),
  type: Schema.optional(Schema.Literal('dynamic', 'static', 'kinematic')),
  fixedRotation: Schema.optional(Schema.Boolean),
  angularDamping: Schema.optional(Schema.Number.pipe(Schema.finite())),
  allowSleep: Schema.optional(Schema.Boolean),
})
export type AddBodyConfig = Schema.Schema.Type<typeof AddBodyConfigSchema>

export class PhysicsService extends Effect.Service<PhysicsService>()(
  '@minecraft/application/PhysicsService',
  {
    effect: Effect.all([
      RigidBodyPort,
      PhysicsWorldPort,
      ShapePort,
      // Internal state: CustomWorld stored in a Ref
      Ref.make<Option.Option<CustomWorld>>(Option.none()),
      // Internal body registry: maps PhysicsBodyId -> CustomBody
      Ref.make(HashMap.empty<PhysicsBodyId, CustomBody>()),
      // Per-instance body ID counter
      Ref.make(0),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([rigidBodyService, physicsWorldService, shapeService, worldRef, bodyMapRef, nextBodyIdRef]) => {
      const makeBodyId: Effect.Effect<PhysicsBodyId, never> =
        Ref.modify(nextBodyIdRef, (n) => [PhysicsBodyId.make(`physics-body-${n}`), n + 1])

      const getWorld: Effect.Effect<CustomWorld, PhysicsServiceError> = Ref.get(worldRef).pipe(
        Effect.flatMap((world) =>
          Option.match(world, {
            onNone: () => Effect.fail(new PhysicsServiceError({ operation: 'getWorld', cause: 'Physics world not initialized. Call initialize() first.' })),
            onSome: (w) => Effect.succeed(w),
          })
        )
      )

      const getBody = (bodyId: PhysicsBodyId): Effect.Effect<CustomBody, PhysicsServiceError> =>
        Ref.get(bodyMapRef).pipe(
          Effect.flatMap((bodyMap) =>
            Option.match(HashMap.get(bodyMap, bodyId), {
              onNone: () => Effect.fail(new PhysicsServiceError({ operation: 'getBody', cause: `Body not found: ${bodyId}` })),
              onSome: Effect.succeed,
            })
          )
        )

      return {
        initialize: (config: { gravity: Vector3; broadphase: 'naive' | 'sap' }): Effect.Effect<void, PhysicsServiceError> =>
          Effect.gen(function* () {
            // Create the world first (side effect outside the critical section)
            const newWorld = yield* physicsWorldService.create({
              gravity: config.gravity,
              broadphase: config.broadphase,
            }).pipe(Effect.mapError((e) => new PhysicsServiceError({ operation: 'initialize', cause: e })))

            // Atomic check-and-set: write only if still None
            const wasAlreadyInit = yield* Ref.modify(worldRef, (current) =>
              Option.match(current, {
                onSome: () => [true, current] as const,
                onNone: () => [false, Option.some(newWorld)] as const,
              })
            )

            if (wasAlreadyInit) return
          }),

        addBody: (config: AddBodyConfig): Effect.Effect<PhysicsBodyId, PhysicsServiceError> =>
          getWorld.pipe(
            Effect.flatMap((world) =>
              Effect.gen(function* () {
                // Create shape — exhaustive dispatch over the shape literal
                const shape: CustomShape = yield* Match.value(config.shape).pipe(
                  Match.when('box', () => {
                    const halfExtents = Option.getOrElse(
                      Option.flatMap(Option.fromNullable(config.shapeParams), (s) => Option.fromNullable(s.halfExtents)),
                      () => ({ x: 0.5, y: 0.5, z: 0.5 })
                    )
                    return shapeService.createBox({ halfExtents })
                  }),
                  Match.when('sphere', () => {
                    const radius = Option.getOrElse(
                      Option.flatMap(Option.fromNullable(config.shapeParams), (s) => Option.fromNullable(s.radius)),
                      () => 0.5
                    )
                    return shapeService.createSphere({ radius })
                  }),
                  Match.when('plane', () => shapeService.createPlane()),
                  Match.exhaustive,
                )

                // Build body config
                const bodyConfig = {
                  mass: config.mass,
                  position: config.position,
                  quaternion: { x: 0, y: 0, z: 0, w: 1 },
                  ...Option.match(Option.fromNullable(config.type), { onNone: () => ({}), onSome: (t) => ({ type: t }) }),
                }

                // Create body
                const body = yield* rigidBodyService.create(bodyConfig)
                yield* rigidBodyService.addShape(body, shape)

                // Apply optional physics properties
                yield* Effect.sync(() => {
                  Option.map(Option.fromNullable(config.fixedRotation), (v) => { body.fixedRotation = v })
                  Option.map(Option.fromNullable(config.angularDamping), (v) => { body.angularDamping = v })
                  Option.map(Option.fromNullable(config.allowSleep), (v) => { body.allowSleep = v })
                })

                yield* rigidBodyService.updateMassProperties(body)

                // Generate opaque ID
                const bodyId = yield* makeBodyId

                // Add body to world and register
                yield* physicsWorldService.addBody(world, body)
                yield* Ref.update(bodyMapRef, (m) => HashMap.set(m, bodyId, body))

                return bodyId
              }).pipe(
                Effect.mapError((e) => new PhysicsServiceError({ operation: 'addBody', cause: e }))
              )
            )
          ),

        removeBody: (bodyId: PhysicsBodyId): Effect.Effect<void, PhysicsServiceError> =>
          Effect.gen(function* () {
            const world = yield* getWorld
            const body = yield* getBody(bodyId)
            yield* physicsWorldService.removeBody(world, body).pipe(
              Effect.mapError((e) => new PhysicsServiceError({ operation: 'removeBody', cause: e }))
            )
            yield* Ref.update(bodyMapRef, (m) => HashMap.remove(m, bodyId))
          }),

        step: (deltaTime: DeltaTimeSecs): Effect.Effect<void, PhysicsServiceError> =>
          Effect.gen(function* () {
            const world = yield* getWorld
            yield* physicsWorldService.step(world, deltaTime).pipe(
              Effect.mapError((e) => new PhysicsServiceError({ operation: 'step', cause: e }))
            )
          }),

        getVelocity: (bodyId: PhysicsBodyId): Effect.Effect<Vector3, PhysicsServiceError> =>
          getBody(bodyId).pipe(
            Effect.map((body) => ({
              x: body.velocity.x,
              y: body.velocity.y,
              z: body.velocity.z,
            }))
          ),

        // Note: returns plain {x,y,z} (no Schema.make per call). The body's position
        // came from the trusted physics step; validating finite-ness on every frame is
        // wasted work. Outer service surfaces (e.g. settings/serialize) still validate.
        getPosition: (bodyId: PhysicsBodyId): Effect.Effect<Position, PhysicsServiceError> =>
          getBody(bodyId).pipe(
            Effect.map((body) => ({
              x: body.position.x,
              y: body.position.y,
              z: body.position.z,
            }))
          ),

        setVelocity: (bodyId: PhysicsBodyId, velocity: Vector3): Effect.Effect<void, PhysicsServiceError> =>
          getBody(bodyId).pipe(
            Effect.flatMap((body) =>
              rigidBodyService.setVelocity(body, velocity).pipe(
                Effect.mapError((e) => new PhysicsServiceError({ operation: 'setVelocity', cause: e }))
              )
            )
          ),

        setPosition: (bodyId: PhysicsBodyId, position: Position): Effect.Effect<void, PhysicsServiceError> =>
          getBody(bodyId).pipe(
            Effect.flatMap((body) =>
              rigidBodyService.setPosition(body, position).pipe(
                Effect.mapError((e) => new PhysicsServiceError({ operation: 'setPosition', cause: e }))
              )
            )
          ),
      }
    })),
  }
) {}
export const PhysicsServiceLive = PhysicsService.Default
