import { Effect, Schema } from 'effect'
import type { Simplify } from 'effect/Types'
import { PhysicsError, fromParseError } from './errors'

const PositiveFloatSchema = Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0), Schema.brand('PositiveFloat'))

const NonNegativeFloatSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand('NonNegativeFloat')
)

const UnitIntervalSchema = Schema.Number.pipe(Schema.finite(), Schema.between(0, 1), Schema.brand('UnitInterval'))

export type PositiveFloat = Schema.Schema.Type<typeof PositiveFloatSchema>
export type NonNegativeFloat = Schema.Schema.Type<typeof NonNegativeFloatSchema>
export type UnitInterval = Schema.Schema.Type<typeof UnitIntervalSchema>

export const EpochMillisSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand('EpochMillis')
)
export type EpochMillis = Schema.Schema.Type<typeof EpochMillisSchema>

export const Vector3Schema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
}).pipe(Schema.brand('Vector3'))
export type Vector3 = Schema.Schema.Type<typeof Vector3Schema>

export const AABBSchema = Schema.Struct({
  min: Vector3Schema,
  max: Vector3Schema,
}).pipe(Schema.brand('AxisAlignedBoundingBox'))
export type AABB = Schema.Schema.Type<typeof AABBSchema>

export const PhysicsMaterialSchema = Schema.Literal(
  'stone',
  'dirt',
  'wood',
  'metal',
  'glass',
  'water',
  'lava',
  'ice',
  'sand',
  'rubber'
)
export type PhysicsMaterial = Schema.Schema.Type<typeof PhysicsMaterialSchema>

export const RigidBodyTypeSchema = Schema.Literal('static', 'dynamic', 'kinematic')
export type RigidBodyType = Schema.Schema.Type<typeof RigidBodyTypeSchema>

export const PhysicsWorldIdSchema = Schema.String.pipe(Schema.minLength(8), Schema.brand('PhysicsWorldId'))
export type PhysicsWorldId = Schema.Schema.Type<typeof PhysicsWorldIdSchema>

export const RigidBodyIdSchema = Schema.String.pipe(Schema.minLength(8), Schema.brand('RigidBodyId'))
export type RigidBodyId = Schema.Schema.Type<typeof RigidBodyIdSchema>

export const PhysicsConfigSchema = Schema.Struct({
  timeStep: PositiveFloatSchema,
  maxSubSteps: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
  damping: UnitIntervalSchema,
  solverIterations: Schema.Number.pipe(Schema.int(), Schema.between(1, 40)),
}).pipe(Schema.brand('PhysicsConfig'))
export type PhysicsConfig = Schema.Schema.Type<typeof PhysicsConfigSchema>

export const MotionStateSchema = Schema.Struct({
  position: Vector3Schema,
  velocity: Vector3Schema,
  acceleration: Vector3Schema,
}).pipe(Schema.brand('MotionState'))
export type MotionState = Schema.Schema.Type<typeof MotionStateSchema>

export const PhysicsWorldStateSchema = Schema.Struct({
  isRunning: Schema.Boolean,
  totalTime: NonNegativeFloatSchema,
  entityCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  activeBodies: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  lastStepAt: EpochMillisSchema,
}).pipe(Schema.brand('PhysicsWorldState'))
export type PhysicsWorldState = Schema.Schema.Type<typeof PhysicsWorldStateSchema>

export const RigidBodySchema = Schema.Struct({
  id: RigidBodyIdSchema,
  worldId: PhysicsWorldIdSchema,
  entityId: Schema.String,
  bodyType: RigidBodyTypeSchema,
  material: PhysicsMaterialSchema,
  mass: PositiveFloatSchema,
  motion: MotionStateSchema,
  restitution: UnitIntervalSchema,
  friction: UnitIntervalSchema,
  createdAt: EpochMillisSchema,
  updatedAt: EpochMillisSchema,
}).pipe(Schema.brand('RigidBody'))
export type RigidBody = Schema.Schema.Type<typeof RigidBodySchema>

export const PhysicsWorldSchema = Schema.Struct({
  id: PhysicsWorldIdSchema,
  config: PhysicsConfigSchema,
  gravity: Vector3Schema,
  state: PhysicsWorldStateSchema,
  createdAt: EpochMillisSchema,
  updatedAt: EpochMillisSchema,
}).pipe(Schema.brand('PhysicsWorld'))
export type PhysicsWorld = Schema.Schema.Type<typeof PhysicsWorldSchema>

export const decodeWith =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (input: unknown): Effect.Effect<A, PhysicsError, R> =>
    Effect.mapError(Schema.decodeUnknown(schema)(input), fromParseError)

export const decodeConstant =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (input: unknown): A =>
    Effect.runSync(decodeWith(schema)(input))

export type WithMotion<T extends { motion: MotionState }> = Simplify<T>

export const positiveFloat = (input: unknown): PositiveFloat => decodeConstant(PositiveFloatSchema)(input)
export const nonNegativeFloat = (input: unknown): NonNegativeFloat => decodeConstant(NonNegativeFloatSchema)(input)
export const unitInterval = (input: unknown): UnitInterval => decodeConstant(UnitIntervalSchema)(input)
export const vector3 = (input: unknown): Vector3 => decodeConstant(Vector3Schema)(input)
export const aabb = (input: unknown): AABB => decodeConstant(AABBSchema)(input)

export const parsePositiveFloat = (input: unknown) => decodeWith(PositiveFloatSchema)(input)
export const parseNonNegativeFloat = (input: unknown) => decodeWith(NonNegativeFloatSchema)(input)
export const parseUnitInterval = (input: unknown) => decodeWith(UnitIntervalSchema)(input)
export const parseVector3 = (input: unknown) => decodeWith(Vector3Schema)(input)
export const parseAABB = (input: unknown) => decodeWith(AABBSchema)(input)
