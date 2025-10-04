import type { PhysicsMaterial, PositiveFloat, UnitInterval, Vector3 } from './core'
import { positiveFloat, unitInterval, vector3 } from './core'

export interface PhysicsConstants {
  readonly gravity: Vector3
  readonly terminalVelocity: PositiveFloat
  readonly airDensity: PositiveFloat
  readonly airDrag: UnitInterval
  readonly fluidDrag: UnitInterval
}

export const PHYSICS_CONSTANTS: PhysicsConstants = {
  gravity: vector3({ x: 0, y: -9.80665, z: 0 }),
  terminalVelocity: positiveFloat(78.4),
  airDensity: positiveFloat(1.2041),
  airDrag: unitInterval(0.985),
  fluidDrag: unitInterval(0.6),
}

export const MATERIAL_FRICTION: Record<PhysicsMaterial, UnitInterval> = {
  stone: unitInterval(0.7),
  dirt: unitInterval(0.62),
  wood: unitInterval(0.63),
  metal: unitInterval(0.58),
  glass: unitInterval(0.5),
  water: unitInterval(0.3),
  lava: unitInterval(0.28),
  ice: unitInterval(0.02),
  sand: unitInterval(0.55),
  rubber: unitInterval(0.9),
}

export const PERFORMANCE_THRESHOLDS = {
  warningFrameTime: positiveFloat(22),
  criticalFrameTime: positiveFloat(33),
}
