export {
  PhysicsService,
  PhysicsServiceLive,
  GROUND_DETECTION_DISTANCE,
  PLAYER_FEET_OFFSET,
} from './physics-service'

export type {
  PhysicsBody,
  PhysicsRaycastResult,
} from './physics-service'

export {
  DEFAULT_GRAVITY,
  calculateJumpVelocity,
  clampVelocity,
  applyFriction,
  updatePosition,
  checkGroundedByDistance,
  getHorizontalSpeed,
  getTotalSpeed,
  normalizeHorizontalVelocity,
  zeroVelocity,
  zeroPosition,
  addVelocities,
  scaleVelocity,
} from './physics-utils'

export type {
  Position,
  Velocity,
} from './physics-utils'
