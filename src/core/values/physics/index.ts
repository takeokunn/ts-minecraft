/**
 * Physics-related Value Objects
 * Exports Velocity and AABB with their associated functions
 */

// Velocity exports
export {
  // Types and schemas
  Velocity,
  VelocitySchema,
  type Velocity as VelocityType,
  
  // Factory and constants
  create as createVelocity,
  ZERO as ZERO_VELOCITY,
  GRAVITY_VECTOR,
  MAX_VELOCITY,
  MIN_VELOCITY,
  TERMINAL_VELOCITY,
  GRAVITY,
  
  // Operations
  magnitude,
  squaredMagnitude,
  normalize,
  scale as scaleVelocity,
  add as addVelocity,
  subtract as subtractVelocity,
  accelerate,
  applyGravity,
  applyFriction,
  applyAirResistance,
  clampToMaxSpeed,
  
  // Component setters
  setX,
  setY,
  setZ,
  zeroX,
  zeroY,
  zeroZ,
  zeroHorizontal,
  zeroVertical,
  
  // Transformations
  invert,
  reflect,
  lerp as lerpVelocity,
  
  // Utilities
  isNearZero,
  isMovingUp,
  isMovingDown,
  isFalling,
  horizontalSpeed,
  getYaw,
  getPitch,
  fromSpeedAndDirection,
  toArray as velocityToArray,
  fromArray as velocityFromArray,
  toString as velocityToString,
  toVector3 as velocityToVector3,
  
  // Common patterns
  jump,
  sprintBoost,
  applyWaterPhysics,
} from './velocity.value'

// AABB exports
export {
  // Types and schemas
  AABB,
  AABBSchema,
  type AABB as AABBType,
  
  // Factory and constants
  create as createAABB,
  fromPositions,
  fromCenterAndHalfExtents,
  UNIT_CUBE,
  PLAYER_HITBOX,
  
  // Measurements
  width,
  height,
  depth,
  volume,
  center as aabbCenter,
  surfaceArea,
  
  // Collision detection
  containsPosition,
  intersects,
  intersection,
  penetrationDepth,
  closestPoint,
  
  // Transformations
  union,
  translate as translateAABB,
  translateTo,
  expand,
  contract,
  scale as scaleAABB,
  
  // Utilities
  isValid,
  getCorners,
  toString as aabbToString,
} from './aabb.value'