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
  get gravity() {
    return vector3({ x: 0, y: -9.80665, z: 0 })
  },
  get terminalVelocity() {
    return positiveFloat(78.4)
  },
  get airDensity() {
    return positiveFloat(1.2041)
  },
  get airDrag() {
    return unitInterval(0.985)
  },
  get fluidDrag() {
    return unitInterval(0.6)
  },
}

export const MATERIAL_FRICTION: Record<PhysicsMaterial, UnitInterval> = {
  get stone() {
    return unitInterval(0.7)
  },
  get dirt() {
    return unitInterval(0.62)
  },
  get wood() {
    return unitInterval(0.63)
  },
  get metal() {
    return unitInterval(0.58)
  },
  get glass() {
    return unitInterval(0.5)
  },
  get water() {
    return unitInterval(0.3)
  },
  get lava() {
    return unitInterval(0.28)
  },
  get ice() {
    return unitInterval(0.02)
  },
  get sand() {
    return unitInterval(0.55)
  },
  get rubber() {
    return unitInterval(0.9)
  },
}

export const PERFORMANCE_THRESHOLDS = {
  get warningFrameTime() {
    return positiveFloat(22)
  },
  get criticalFrameTime() {
    return positiveFloat(33)
  },
}
