/**
 * Position vector
 */
export interface Position {
  readonly x: number
  readonly y: number
  readonly z: number
}

/**
 * Velocity vector
 */
export interface Velocity {
  readonly x: number
  readonly y: number
  readonly z: number
}

/**
 * Default gravity constant (m/s^2)
 */
export const DEFAULT_GRAVITY = 9.82

/**
 * Calculate the initial velocity needed to jump to a specific height
 *
 * Uses kinematic equation: v = sqrt(2 * g * h)
 *
 * @param height - The target jump height in meters
 * @param gravity - The gravity acceleration (default: 9.82 m/s^2)
 * @returns The initial upward velocity needed
 */
export const calculateJumpVelocity = (
  height: number,
  gravity: number = DEFAULT_GRAVITY
): number => {
  if (height <= 0 || gravity <= 0) {
    return 0
  }
  return Math.sqrt(2 * gravity * height)
}

/**
 * Clamp velocity magnitude to a maximum speed
 *
 * @param velocity - The velocity to clamp
 * @param maxSpeed - The maximum speed allowed
 * @returns The clamped velocity
 */
export const clampVelocity = (
  velocity: Velocity,
  maxSpeed: number
): Velocity => {
  if (maxSpeed <= 0) {
    return { x: 0, y: 0, z: 0 }
  }

  const horizontalSpeed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)

  if (horizontalSpeed <= maxSpeed) {
    return velocity
  }

  const scale = maxSpeed / horizontalSpeed
  return {
    x: velocity.x * scale,
    y: velocity.y, // Y velocity is not clamped (gravity/jump handled separately)
    z: velocity.z * scale,
  }
}

/**
 * Apply friction to horizontal velocity
 *
 * @param velocity - The velocity to apply friction to
 * @param friction - The friction coefficient (0-1, where 1 is no friction)
 * @param deltaTime - Time step in seconds
 * @returns The velocity after friction is applied
 */
export const applyFriction = (
  velocity: Velocity,
  friction: number,
  deltaTime: number
): Velocity => {
  if (friction < 0 || friction > 1 || deltaTime <= 0) {
    return velocity
  }

  // Friction reduces velocity over time
  // friction of 1 means no friction, friction of 0 means instant stop
  const frictionFactor = Math.max(0, 1 - (1 - friction) * deltaTime * 10)

  return {
    x: velocity.x * frictionFactor,
    y: velocity.y, // Y velocity not affected by ground friction
    z: velocity.z * frictionFactor,
  }
}

/**
 * Update position based on velocity and time step
 *
 * Uses simple Euler integration: new_pos = pos + vel * dt
 *
 * @param position - Current position
 * @param velocity - Current velocity
 * @param deltaTime - Time step in seconds
 * @returns The new position
 */
export const updatePosition = (
  position: Position,
  velocity: Velocity,
  deltaTime: number
): Position => {
  if (deltaTime <= 0) {
    return position
  }

  return {
    x: position.x + velocity.x * deltaTime,
    y: position.y + velocity.y * deltaTime,
    z: position.z + velocity.z * deltaTime,
  }
}

/**
 * Check if a point is on the ground by raycasting
 *
 * @param playerY - Player's Y position (feet)
 * @param groundY - Ground Y position
 * @param threshold - Distance threshold for ground detection (default: 0.15m)
 * @returns Whether the player is grounded
 */
export const checkGroundedByDistance = (
  playerY: number,
  groundY: number,
  threshold: number = 0.15
): boolean => {
  const distanceToGround = playerY - groundY
  return distanceToGround >= 0 && distanceToGround <= threshold
}

/**
 * Calculate horizontal speed from velocity
 *
 * @param velocity - The velocity vector
 * @returns The horizontal speed (magnitude in XZ plane)
 */
export const getHorizontalSpeed = (velocity: Velocity): number => {
  return Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
}

/**
 * Calculate total speed from velocity
 *
 * @param velocity - The velocity vector
 * @returns The total speed (magnitude)
 */
export const getTotalSpeed = (velocity: Velocity): number => {
  return Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)
}

/**
 * Normalize horizontal velocity to a specific speed
 *
 * @param velocity - The velocity to normalize
 * @param targetSpeed - The target horizontal speed
 * @returns The normalized velocity
 */
export const normalizeHorizontalVelocity = (
  velocity: Velocity,
  targetSpeed: number
): Velocity => {
  if (targetSpeed <= 0) {
    return { x: 0, y: velocity.y, z: 0 }
  }

  const currentSpeed = getHorizontalSpeed(velocity)

  if (currentSpeed === 0) {
    return { x: 0, y: velocity.y, z: 0 }
  }

  const scale = targetSpeed / currentSpeed
  return {
    x: velocity.x * scale,
    y: velocity.y,
    z: velocity.z * scale,
  }
}

/**
 * Create a zero velocity vector
 */
export const zeroVelocity = (): Velocity => ({ x: 0, y: 0, z: 0 })

/**
 * Create a zero position vector
 */
export const zeroPosition = (): Position => ({ x: 0, y: 0, z: 0 })

/**
 * Add two velocities together
 */
export const addVelocities = (a: Velocity, b: Velocity): Velocity => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
})

/**
 * Scale a velocity by a scalar
 */
export const scaleVelocity = (velocity: Velocity, scalar: number): Velocity => ({
  x: velocity.x * scalar,
  y: velocity.y * scalar,
  z: velocity.z * scalar,
})
