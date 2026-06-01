import { Effect, Match, Option, Ref, Data, Schema, HashMap } from 'effect'
import { PhysicsBodyId, Position, PositionSchema, DeltaTimeSecs } from '@ts-minecraft/core'
import { Vector3Schema, type Vector3 } from '@ts-minecraft/core'
import { PhysicsWorldPort, RigidBodyPort, ShapePort } from '../domain/physics-port'
import type { CustomBody, CustomShape } from '../domain/physics-body'
import type { CustomWorld, WorldConfig } from '../domain/physics-world'

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
})
export type AddBodyConfig = Schema.Schema.Type<typeof AddBodyConfigSchema>

export class PhysicsService extends Effect.Service<PhysicsService>()(
  '@minecraft/application/PhysicsService',
  {
    effect: Effect.all([
      RigidBodyPort,
      PhysicsWorldPort,
      ShapePort,
      Ref.make<Option.Option<CustomWorld>>(Option.none()),
      Ref.make(HashMap.empty<PhysicsBodyId, CustomBody>()),
      Ref.make(0),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([rigidBodyPort, physicsWorldPort, shapePort, worldRef, bodyMapRef, nextBodyIdRef]) => {
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
        initialize: (config: WorldConfig): Effect.Effect<void, PhysicsServiceError> =>
          Effect.gen(function* () {
            const newWorld = yield* physicsWorldPort.create(config).pipe(
              Effect.mapError((e) => new PhysicsServiceError({ operation: 'initialize', cause: e }))
            )

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
                const shape: CustomShape = yield* Match.value(config.shape).pipe(
                  Match.when('box', () => {
                    const halfExtents = Option.getOrElse(
                      Option.flatMap(Option.fromNullable(config.shapeParams), (s) => Option.fromNullable(s.halfExtents)),
                      () => ({ x: 0.5, y: 0.5, z: 0.5 })
                    )
                    return shapePort.createBox({ halfExtents })
                  }),
                  Match.when('sphere', () => {
                    const radius = Option.getOrElse(
                      Option.flatMap(Option.fromNullable(config.shapeParams), (s) => Option.fromNullable(s.radius)),
                      () => 0.5
                    )
                    return shapePort.createSphere({ radius })
                  }),
                  Match.when('plane', () => shapePort.createPlane()),
                  Match.exhaustive,
                )

                const body = yield* rigidBodyPort.create({
                  mass: config.mass,
                  position: config.position,
                  type: config.type,
                })
                yield* rigidBodyPort.addShape(body, shape)

                const bodyId = yield* makeBodyId

                yield* physicsWorldPort.addBody(world, body)
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
            yield* physicsWorldPort.removeBody(world, body).pipe(
              Effect.mapError((e) => new PhysicsServiceError({ operation: 'removeBody', cause: e }))
            )
            yield* Ref.update(bodyMapRef, (m) => HashMap.remove(m, bodyId))
          }),

        step: (deltaTime: DeltaTimeSecs): Effect.Effect<void, PhysicsServiceError> =>
          Effect.gen(function* () {
            const world = yield* getWorld
            yield* physicsWorldPort.step(world, deltaTime).pipe(
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
              rigidBodyPort.setVelocity(body, velocity).pipe(
                Effect.mapError((e) => new PhysicsServiceError({ operation: 'setVelocity', cause: e }))
              )
            )
          ),

        setPosition: (bodyId: PhysicsBodyId, position: Position): Effect.Effect<void, PhysicsServiceError> =>
          getBody(bodyId).pipe(
            Effect.flatMap((body) =>
              rigidBodyPort.setPosition(body, position).pipe(
                Effect.mapError((e) => new PhysicsServiceError({ operation: 'setPosition', cause: e }))
              )
            )
          ),
      }
    })),
  }
) {}
export const PhysicsServiceLive = PhysicsService.Default
