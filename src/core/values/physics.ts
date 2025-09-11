import * as S from '@effect/schema/Schema'
import { Brand, Data } from 'effect'

// Mass with branded types for physics calculations
export type Mass = number & Brand.Brand<'Mass'>

export const Mass = Brand.refined<Mass>(
  (n): n is number => Number.isFinite(n) && n > 0,
  (n) => Brand.error(`Invalid Mass: ${n} (must be positive)`),
)

export const MassSchema = S.Number.pipe(
  S.finite(),
  S.positive(),
  S.brand('Mass'),
)

// Force vectors for physics simulations
export type Force = number & Brand.Brand<'Force'>

export const Force = Brand.refined<Force>(
  (n): n is number => Number.isFinite(n),
  (n) => Brand.error(`Invalid Force: ${n}`),
)

export const ForceSchema = S.Number.pipe(
  S.finite(),
  S.brand('Force'),
)

export const Force3DSchema = S.Struct({
  fx: ForceSchema,
  fy: ForceSchema,
  fz: ForceSchema,
})

export type Force3D = Data.Struct<{
  readonly fx: Force
  readonly fy: Force
  readonly fz: Force
}>

export const Force3D = Data.struct<Force3D>()

export const makeForce3D = (fx: number, fy: number, fz: number): Force3D =>
  Force3D({
    fx: Force(fx),
    fy: Force(fy),
    fz: Force(fz),
  })

export const zeroForce = (): Force3D =>
  Force3D({
    fx: Force(0),
    fy: Force(0),
    fz: Force(0),
  })

// Acceleration for physics calculations
export type Acceleration = number & Brand.Brand<'Acceleration'>

export const Acceleration = Brand.refined<Acceleration>(
  (n): n is number => Number.isFinite(n),
  (n) => Brand.error(`Invalid Acceleration: ${n}`),
)

export const AccelerationSchema = S.Number.pipe(
  S.finite(),
  S.brand('Acceleration'),
)

export const Acceleration3DSchema = S.Struct({
  ax: AccelerationSchema,
  ay: AccelerationSchema,
  az: AccelerationSchema,
})

export type Acceleration3D = Data.Struct<{
  readonly ax: Acceleration
  readonly ay: Acceleration
  readonly az: Acceleration
}>

export const Acceleration3D = Data.struct<Acceleration3D>()

export const makeAcceleration3D = (ax: number, ay: number, az: number): Acceleration3D =>
  Acceleration3D({
    ax: Acceleration(ax),
    ay: Acceleration(ay),
    az: Acceleration(az),
  })

// Physics constants as branded types
export const GRAVITY = Force(-9.81)
export const AIR_RESISTANCE = Force(0.98)
export const TERMINAL_VELOCITY = Force(53.4)

// Pure functions for physics calculations
export const applyForce = (force: Force3D) => (mass: Mass) => (currentAccel: Acceleration3D): Acceleration3D =>
  makeAcceleration3D(
    currentAccel.ax + force.fx / mass,
    currentAccel.ay + force.fy / mass,
    currentAccel.az + force.fz / mass,
  )

export const addForces = (forces: ReadonlyArray<Force3D>): Force3D =>
  forces.reduce(
    (acc, force) => makeForce3D(
      acc.fx + force.fx,
      acc.fy + force.fy,
      acc.fz + force.fz,
    ),
    zeroForce(),
  )

// Friction calculation
export const applyFriction = (coefficient: number) => (force: Force3D): Force3D =>
  makeForce3D(
    force.fx * coefficient,
    force.fy * coefficient,
    force.fz * coefficient,
  )

// Momentum calculation
export const calculateMomentum = (mass: Mass) => (velocity: { dx: number; dy: number; dz: number }) =>
  makeForce3D(
    mass * velocity.dx,
    mass * velocity.dy,
    mass * velocity.dz,
  )