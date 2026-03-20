export {
  PhysicsService,
  PhysicsServiceLive,
  PhysicsServiceError,
  AddBodyConfigSchema,
  GROUND_DETECTION_DISTANCE,
  PLAYER_FEET_OFFSET,
} from './physics-service'

export type {
  PhysicsBody,
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
