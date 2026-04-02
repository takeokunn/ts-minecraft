export {
  PhysicsService,
  PhysicsServiceLive,
  PhysicsServiceError,
  AddBodyConfigSchema,
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
