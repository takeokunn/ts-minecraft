export {
  PhysicsService,
  PhysicsServiceLive,
  PhysicsError,
  GROUND_DETECTION_DISTANCE,
  PLAYER_FEET_OFFSET,
} from './physics-service'

export type {
  PhysicsBody,
  PhysicsRaycastHit,
  AddBodyConfig,
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
