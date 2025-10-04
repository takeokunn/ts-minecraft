import { Clock, Effect, Match, Random, pipe } from 'effect'
import {
  EpochMillisSchema,
  MotionState,
  MotionStateSchema,
  PhysicsWorldId,
  RigidBody,
  RigidBodyId,
  RigidBodyIdSchema,
  RigidBodySchema,
  RigidBodyType,
  Vector3,
  decodeWith,
  parsePositiveFloat,
  parseUnitInterval,
  parseVector3,
  vector3,
} from '../types/core'
import type { PhysicsError } from '../types/errors'
import { FrictionCoefficient } from '../value_object/friction_coefficient'

const defaultMotionState = (position: Vector3): MotionState =>
  Effect.runSync(
    decodeWith(MotionStateSchema)({
      position,
      velocity: vector3({ x: 0, y: 0, z: 0 }),
      acceleration: vector3({ x: 0, y: 0, z: 0 }),
    })
  )

const generateId = (): Effect.Effect<RigidBodyId, PhysicsError> =>
  Effect.gen(function* () {
    const random = yield* Random.next
    const millis = yield* Clock.currentTimeMillis
    const raw = `body-${random.toString(16)}-${millis.toString(36)}`
    return yield* decodeWith(RigidBodyIdSchema)(raw)
  })

const create = (params: {
  readonly worldId: PhysicsWorldId
  readonly entityId: string
  readonly bodyType: RigidBodyType
  readonly material: Parameters<typeof FrictionCoefficient.fromMaterial>[0]
  readonly mass: unknown
  readonly position: Vector3
  readonly restitution?: unknown
  readonly friction?: unknown
}): Effect.Effect<RigidBody, PhysicsError> =>
  Effect.gen(function* () {
    const id = yield* generateId()
    const mass = yield* parsePositiveFloat(params.mass)
    const motion = defaultMotionState(params.position)
    const createdAtMillis = yield* Clock.currentTimeMillis
    const createdAt = yield* decodeWith(EpochMillisSchema)(createdAtMillis)
    const frictionPreset = FrictionCoefficient.fromMaterial(params.material)
    const frictionValue = yield* pipe(
      params.friction,
      Match.value,
      Match.when(
        (value) => value === undefined,
        () => Effect.succeed(frictionPreset.coefficient)
      ),
      Match.orElse((value) => parseUnitInterval(value))
    )
    const restitution = yield* pipe(params.restitution ?? 0.3, parseUnitInterval)

    return yield* decodeWith(RigidBodySchema)({
      id,
      worldId: params.worldId,
      entityId: params.entityId,
      bodyType: params.bodyType,
      material: params.material,
      mass,
      motion,
      restitution,
      friction: frictionValue,
      createdAt,
      updatedAt: createdAt,
    })
  })

const updateMotion = (body: RigidBody, position: Vector3, velocity: Vector3): Effect.Effect<RigidBody, PhysicsError> =>
  Effect.gen(function* () {
    const motion = yield* decodeWith(MotionStateSchema)({
      position,
      velocity,
      acceleration: body.motion.acceleration,
    })
    return {
      ...body,
      motion,
    }
  })

const applyForce = (body: RigidBody, force: Vector3, deltaTime: unknown): Effect.Effect<RigidBody, PhysicsError> =>
  Effect.gen(function* () {
    const dt = yield* parsePositiveFloat(deltaTime)
    const acceleration = {
      x: force.x / body.mass,
      y: force.y / body.mass,
      z: force.z / body.mass,
    }
    const velocity = yield* parseVector3({
      x: body.motion.velocity.x + acceleration.x * dt,
      y: body.motion.velocity.y + acceleration.y * dt,
      z: body.motion.velocity.z + acceleration.z * dt,
    })
    const position = yield* parseVector3({
      x: body.motion.position.x + velocity.x * dt,
      y: body.motion.position.y + velocity.y * dt,
      z: body.motion.position.z + velocity.z * dt,
    })
    return yield* updateMotion(body, position, velocity)
  })

const dampenVelocity = (body: RigidBody, coefficient: number): Effect.Effect<RigidBody, PhysicsError> =>
  Effect.map(
    parseVector3({
      x: body.motion.velocity.x * coefficient,
      y: body.motion.velocity.y * coefficient,
      z: body.motion.velocity.z * coefficient,
    }),
    (velocity) => ({
      ...body,
      motion: {
        ...body.motion,
        velocity,
      },
    })
  )

const touchGround = (body: RigidBody): Effect.Effect<RigidBody, PhysicsError> =>
  pipe(
    body.bodyType,
    Match.value,
    Match.when('static', () => Effect.succeed(body)),
    Match.orElse(() => dampenVelocity(body, 0))
  )

export const RigidBodyAggregate = {
  schema: RigidBodySchema,
  create,
  updateMotion,
  applyForce,
  dampenVelocity,
  touchGround,
}
