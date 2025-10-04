import { Effect, Match, Schema, pipe } from 'effect'
import {
  Vector3Schema,
  parsePositiveFloat,
  parseUnitInterval,
  parseVector3,
  vector3,
  PositiveFloat,
  UnitInterval,
  Vector3,
  positiveFloat,
  nonNegativeFloat,
  decodeWith,
} from '../types/core'
import { PHYSICS_CONSTANTS } from '../types/constants'
import type { PhysicsError } from '../types/errors'

const GravityVectorSchema = Schema.Struct({
  direction: Vector3Schema,
  magnitude: Schema.Number.pipe(Schema.greaterThan(0)),
  terminalVelocity: Schema.Number.pipe(Schema.greaterThan(0)),
  multiplier: Schema.Number.pipe(Schema.between(0, 2)),
}).pipe(Schema.brand('GravityVector'))

export type GravityVector = Schema.Schema.Type<typeof GravityVectorSchema>

const normalize = (vector: Vector3): Effect.Effect<Vector3, PhysicsError> =>
  Effect.gen(function* () {
    const length = Math.hypot(vector.x, vector.y, vector.z)
    const normalized = yield* pipe(
      length,
      Match.value,
      Match.when(
        (value) => value === 0,
        () =>
          Effect.fail<never, PhysicsError>({
            _tag: 'ConstraintViolation',
            message: 'gravity direction cannot be zero vector',
          })
      ),
      Match.orElse((value) =>
        Effect.succeed<Vector3>({
          x: vector.x / value,
          y: vector.y / value,
          z: vector.z / value,
        })
      )
    )
    return normalized
  })

const make = (params: {
  readonly direction?: unknown
  readonly magnitude?: unknown
  readonly multiplier?: unknown
  readonly terminalVelocity?: unknown
}): Effect.Effect<GravityVector, PhysicsError> =>
  Effect.gen(function* () {
    const direction = yield* pipe(
      params.direction ?? vector3({ x: 0, y: -1, z: 0 }),
      parseVector3
    )
    const normalizedDirection = yield* normalize(direction)
    const magnitude = yield* parsePositiveFloat(params.magnitude ?? PHYSICS_CONSTANTS.gravity.y * -1)
    const terminalVelocity = yield* parsePositiveFloat(params.terminalVelocity ?? PHYSICS_CONSTANTS.terminalVelocity)
  const multiplier = yield* parseUnitInterval(params.multiplier ?? 1)

    return yield* decodeWith(GravityVectorSchema)({
      direction: normalizedDirection,
      magnitude,
      multiplier,
      terminalVelocity,
      _tag: 'GravityVector',
    })
  })

const apply = (
  gravity: GravityVector,
  velocity: Vector3,
  deltaTime: PositiveFloat
): Effect.Effect<Vector3, PhysicsError> =>
  pipe(
    {
      x: velocity.x + gravity.direction.x * gravity.magnitude * gravity.multiplier * deltaTime,
      y: Math.max(
        velocity.y + gravity.direction.y * gravity.magnitude * gravity.multiplier * deltaTime,
        -gravity.terminalVelocity
      ),
      z: velocity.z + gravity.direction.z * gravity.magnitude * gravity.multiplier * deltaTime,
    },
    parseVector3
  )

const calculateJumpVelocity = (gravity: GravityVector, jumpHeight: PositiveFloat): PositiveFloat =>
  positiveFloat(Math.sqrt(2 * gravity.magnitude * gravity.multiplier * jumpHeight))

const calculateFallDamage = (fallDistance: PositiveFloat): ReturnType<typeof nonNegativeFloat> =>
  pipe(
    fallDistance,
    Match.value,
    Match.when(
      (distance) => distance <= 3,
      () => nonNegativeFloat(0)
    ),
    Match.orElse((distance) => nonNegativeFloat((distance - 3) * 0.5))
  )

const forMedium = (inFluid: boolean): GravityVector =>
  pipe(
    inFluid,
    Match.value,
    Match.when(false, () =>
      Effect.runSync(
        make({
          direction: vector3({ x: 0, y: -1, z: 0 }),
          magnitude: Math.abs(PHYSICS_CONSTANTS.gravity.y),
        })
      )
    ),
    Match.orElse(() =>
      Effect.runSync(
        make({
          direction: vector3({ x: 0, y: -1, z: 0 }),
          magnitude: Math.abs(PHYSICS_CONSTANTS.gravity.y) * 0.4,
          multiplier: 0.4,
          terminalVelocity: PHYSICS_CONSTANTS.terminalVelocity * 0.4,
        })
      )
    )
  )

const withMultiplier = (
  gravity: GravityVector,
  multiplier: UnitInterval
): GravityVector =>
  Effect.runSync(
    decodeWith(GravityVectorSchema)({
      direction: gravity.direction,
      magnitude: gravity.magnitude,
      terminalVelocity: gravity.terminalVelocity,
      multiplier,
      _tag: 'GravityVector',
    })
  )

const inspect = (gravity: GravityVector): string =>
  `gravity: (${gravity.direction.x.toFixed(3)}, ${gravity.direction.y.toFixed(3)}, ${gravity.direction.z.toFixed(3)}) * ${gravity.magnitude.toFixed(3)} | terminal=${gravity.terminalVelocity.toFixed(2)} | multiplier=${gravity.multiplier}`

export const GravityVector = {
  schema: GravityVectorSchema,
  create: make,
  normalize,
  apply,
  calculateJumpVelocity,
  calculateFallDamage,
  forMedium,
  withMultiplier,
  inspect,
  default: Effect.runSync(make({})),
  fluid: Effect.runSync(make({ multiplier: 0.4, magnitude: PHYSICS_CONSTANTS.gravity.y * -0.4 })),
}
