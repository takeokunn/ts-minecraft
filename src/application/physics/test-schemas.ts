import { Schema, Arbitrary } from 'effect'

/**
 * Schema for valid Position
 */
export const PositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
})

/**
 * Schema for valid Velocity
 */
export const VelocitySchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
})

/**
 * Schema for positive jump heights (0.1 to 10)
 */
export const JumpHeightSchema = Schema.Number.pipe(
  Schema.between(0.1, 10)
)

/**
 * Schema for valid gravity values (1 to 50)
 */
export const GravitySchema = Schema.Number.pipe(
  Schema.between(1, 50)
)

/**
 * Schema for positive max speed values (0.1 to 100)
 */
export const MaxSpeedSchema = Schema.Number.pipe(
  Schema.between(0.1, 100)
)

/**
 * Schema for friction coefficient (0 to 1)
 */
export const FrictionSchema = Schema.Number.pipe(
  Schema.between(0, 1)
)

/**
 * Schema for valid deltaTime (0.001 to 0.1)
 */
export const DeltaTimeSchema = Schema.Number.pipe(
  Schema.between(0.001, 0.1)
)

/**
 * Schema for ground detection threshold (0.01 to 1)
 */
export const GroundThresholdSchema = Schema.Number.pipe(
  Schema.between(0.01, 1)
)

/**
 * Schema for target speed values (0.1 to 50)
 */
export const TargetSpeedSchema = Schema.Number.pipe(
  Schema.between(0.1, 50)
)

/**
 * Schema for positive scalar values (0.1 to 10)
 */
export const PositiveScalarSchema = Schema.Number.pipe(
  Schema.between(0.1, 10)
)

/**
 * Schema for player Y positions near ground (0 to 5)
 */
export const PlayerYSchema = Schema.Number.pipe(
  Schema.between(0, 5)
)

/**
 * Schema for ground Y positions (-10 to 10)
 */
export const GroundYSchema = Schema.Number.pipe(
  Schema.between(-10, 10)
)

// ===========================================
// Arbitraries for Property-Based Testing
// ===========================================

/**
 * Arbitrary for valid Position
 */
export const arbPosition = Arbitrary.make(PositionSchema)

/**
 * Arbitrary for valid Velocity
 */
export const arbVelocity = Arbitrary.make(VelocitySchema)

/**
 * Arbitrary for positive jump heights
 */
export const arbJumpHeight = Arbitrary.make(JumpHeightSchema)

/**
 * Arbitrary for valid gravity values
 */
export const arbGravity = Arbitrary.make(GravitySchema)

/**
 * Arbitrary for positive max speed values
 */
export const arbMaxSpeed = Arbitrary.make(MaxSpeedSchema)

/**
 * Arbitrary for friction coefficient
 */
export const arbFriction = Arbitrary.make(FrictionSchema)

/**
 * Arbitrary for valid deltaTime
 */
export const arbDeltaTime = Arbitrary.make(DeltaTimeSchema)

/**
 * Arbitrary for ground detection threshold
 */
export const arbGroundThreshold = Arbitrary.make(GroundThresholdSchema)

/**
 * Arbitrary for target speed values
 */
export const arbTargetSpeed = Arbitrary.make(TargetSpeedSchema)

/**
 * Arbitrary for positive scalar values
 */
export const arbPositiveScalar = Arbitrary.make(PositiveScalarSchema)

/**
 * Arbitrary for player Y positions near ground
 */
export const arbPlayerY = Arbitrary.make(PlayerYSchema)

/**
 * Arbitrary for ground Y positions
 */
export const arbGroundY = Arbitrary.make(GroundYSchema)

/**
 * Helper to generate a velocity with horizontal components only (Y = 0)
 */
export const arbHorizontalVelocity = Arbitrary.make(
  Schema.Struct({
    x: Schema.Number.pipe(Schema.finite()),
    y: Schema.Literal(0),
    z: Schema.Number.pipe(Schema.finite()),
  })
)

/**
 * Helper to generate small velocities (near zero)
 */
export const arbSmallVelocity = Arbitrary.make(
  Schema.Struct({
    x: Schema.Number.pipe(Schema.between(-0.1, 0.1)),
    y: Schema.Number.pipe(Schema.between(-0.1, 0.1)),
    z: Schema.Number.pipe(Schema.between(-0.1, 0.1)),
  })
)
