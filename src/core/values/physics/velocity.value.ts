import { Data, pipe } from 'effect'
import * as S from "@effect/schema/Schema"

/**
 * Velocity Value Object - Represents 3D velocity/movement vector
 * Implemented using functional programming patterns without classes
 */

// Constants
export const MAX_VELOCITY = 100
export const MIN_VELOCITY = -100
export const TERMINAL_VELOCITY = -78.4 // Minecraft terminal velocity
export const GRAVITY = -32 // Blocks per second squared

// Schema definition with validation
export const VelocitySchema = S.Struct({
  dx: S.Number.pipe(S.finite(), S.clamp(MIN_VELOCITY, MAX_VELOCITY)),
  dy: S.Number.pipe(S.finite(), S.clamp(MIN_VELOCITY, MAX_VELOCITY)),
  dz: S.Number.pipe(S.finite(), S.clamp(MIN_VELOCITY, MAX_VELOCITY)),
})

// Type definition using Data.Struct for immutability
export type Velocity = Data.Struct<{
  readonly dx: number
  readonly dy: number
  readonly dz: number
}>

// Factory function
export const Velocity = Data.struct<Velocity>()

// Create velocity with clamping
export const create = (dx: number, dy: number, dz: number): Velocity =>
  Velocity({
    dx: Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, dx)),
    dy: Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, dy)),
    dz: Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, dz)),
  })

// Common velocity constants
export const ZERO = Velocity({ dx: 0, dy: 0, dz: 0 })
export const GRAVITY_VECTOR = Velocity({ dx: 0, dy: GRAVITY, dz: 0 })

/**
 * Pure functions for Velocity operations
 */

// Calculate magnitude (speed)
export const magnitude = (vel: Velocity): number =>
  Math.sqrt(vel.dx * vel.dx + vel.dy * vel.dy + vel.dz * vel.dz)

// Calculate squared magnitude (more efficient for comparisons)
export const squaredMagnitude = (vel: Velocity): number =>
  vel.dx * vel.dx + vel.dy * vel.dy + vel.dz * vel.dz

// Normalize velocity to unit vector (magnitude = 1)
export const normalize = (vel: Velocity): Velocity => {
  const mag = magnitude(vel)
  if (mag === 0) return ZERO
  return create(vel.dx / mag, vel.dy / mag, vel.dz / mag)
}

// Scale velocity by a factor
export const scale = (factor: number) =>
  (vel: Velocity): Velocity =>
    create(vel.dx * factor, vel.dy * factor, vel.dz * factor)

// Add two velocities
export const add = (other: Velocity) =>
  (vel: Velocity): Velocity =>
    create(vel.dx + other.dx, vel.dy + other.dy, vel.dz + other.dz)

// Subtract velocities
export const subtract = (other: Velocity) =>
  (vel: Velocity): Velocity =>
    create(vel.dx - other.dx, vel.dy - other.dy, vel.dz - other.dz)

// Apply acceleration (change in velocity)
export const accelerate = (ax: number, ay: number, az: number) =>
  (vel: Velocity): Velocity =>
    create(vel.dx + ax, vel.dy + ay, vel.dz + az)

// Apply gravity for given time delta
export const applyGravity = (deltaTime: number) =>
  (vel: Velocity): Velocity =>
    create(vel.dx, Math.max(TERMINAL_VELOCITY, vel.dy + GRAVITY * deltaTime), vel.dz)

// Apply friction/damping
export const applyFriction = (factor: number) =>
  (vel: Velocity): Velocity => {
    if (factor <= 0 || factor >= 1) return vel
    return create(vel.dx * factor, vel.dy, vel.dz * factor)
  }

// Apply air resistance (affects all axes)
export const applyAirResistance = (factor: number) =>
  (vel: Velocity): Velocity => {
    if (factor <= 0 || factor >= 1) return vel
    return scale(factor)(vel)
  }

// Clamp velocity to maximum speed
export const clampToMaxSpeed = (maxSpeed: number) =>
  (vel: Velocity): Velocity => {
    const mag = magnitude(vel)
    if (mag <= maxSpeed) return vel
    return pipe(vel, normalize, scale(maxSpeed))
  }

// Set specific component
export const setX = (dx: number) =>
  (vel: Velocity): Velocity =>
    create(dx, vel.dy, vel.dz)

export const setY = (dy: number) =>
  (vel: Velocity): Velocity =>
    create(vel.dx, dy, vel.dz)

export const setZ = (dz: number) =>
  (vel: Velocity): Velocity =>
    create(vel.dx, vel.dy, dz)

// Zero specific component
export const zeroX = setX(0)
export const zeroY = setY(0)
export const zeroZ = setZ(0)

// Zero horizontal components (keep vertical)
export const zeroHorizontal = (vel: Velocity): Velocity =>
  create(0, vel.dy, 0)

// Zero vertical component (keep horizontal)
export const zeroVertical = (vel: Velocity): Velocity =>
  create(vel.dx, 0, vel.dz)

// Invert velocity (reverse direction)
export const invert = (vel: Velocity): Velocity =>
  create(-vel.dx, -vel.dy, -vel.dz)

// Reflect velocity (for bouncing)
export const reflect = (normal: { x: number; y: number; z: number }) =>
  (vel: Velocity): Velocity => {
    // Normalize the normal vector
    const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z)
    if (len === 0) return vel
    
    const nx = normal.x / len
    const ny = normal.y / len
    const nz = normal.z / len
    
    // Calculate dot product
    const dot = 2 * (vel.dx * nx + vel.dy * ny + vel.dz * nz)
    
    // Reflect: v - 2 * (v · n) * n
    return create(
      vel.dx - dot * nx,
      vel.dy - dot * ny,
      vel.dz - dot * nz
    )
  }

// Lerp between two velocities
export const lerp = (target: Velocity, t: number) =>
  (vel: Velocity): Velocity =>
    create(
      vel.dx + (target.dx - vel.dx) * t,
      vel.dy + (target.dy - vel.dy) * t,
      vel.dz + (target.dz - vel.dz) * t
    )

// Check if velocity is near zero
export const isNearZero = (threshold: number = 0.001) =>
  (vel: Velocity): boolean =>
    Math.abs(vel.dx) < threshold &&
    Math.abs(vel.dy) < threshold &&
    Math.abs(vel.dz) < threshold

// Check if moving upward
export const isMovingUp = (vel: Velocity): boolean => vel.dy > 0

// Check if moving downward
export const isMovingDown = (vel: Velocity): boolean => vel.dy < 0

// Check if falling
export const isFalling = (vel: Velocity): boolean => vel.dy < -0.1

// Get horizontal speed
export const horizontalSpeed = (vel: Velocity): number =>
  Math.sqrt(vel.dx * vel.dx + vel.dz * vel.dz)

// Get direction angle (yaw) in radians
export const getYaw = (vel: Velocity): number =>
  Math.atan2(vel.dz, vel.dx)

// Get pitch angle in radians
export const getPitch = (vel: Velocity): number => {
  const horizontal = horizontalSpeed(vel)
  return Math.atan2(vel.dy, horizontal)
}

// Create velocity from speed and direction
export const fromSpeedAndDirection = (
  speed: number,
  yaw: number,
  pitch: number = 0
): Velocity => {
  const horizontalSpeed = speed * Math.cos(pitch)
  return create(
    horizontalSpeed * Math.cos(yaw),
    speed * Math.sin(pitch),
    horizontalSpeed * Math.sin(yaw)
  )
}

// Convert to array format
export const toArray = (vel: Velocity): [number, number, number] =>
  [vel.dx, vel.dy, vel.dz]

// Create from array
export const fromArray = ([dx, dy, dz]: [number, number, number]): Velocity =>
  create(dx, dy, dz)

// Format as string for debugging
export const toString = (vel: Velocity): string =>
  `Velocity(${vel.dx.toFixed(2)}, ${vel.dy.toFixed(2)}, ${vel.dz.toFixed(2)})`

// Convert to object with different property names (for compatibility)
export const toVector3 = (vel: Velocity): { x: number; y: number; z: number } =>
  ({ x: vel.dx, y: vel.dy, z: vel.dz })

/**
 * Common movement patterns
 */

// Jump velocity (typical Minecraft jump)
export const jump = (strength: number = 10): Velocity =>
  create(0, strength, 0)

// Sprint boost (multiply horizontal speed)
export const sprintBoost = (factor: number = 1.3) =>
  (vel: Velocity): Velocity =>
    create(vel.dx * factor, vel.dy, vel.dz * factor)

// Apply water physics (slower movement)
export const applyWaterPhysics = (vel: Velocity): Velocity =>
  pipe(
    vel,
    scale(0.8),
    applyGravity(0.02)
  )

/**
 * Usage examples:
 * 
 * const velocity = create(5, 0, 5)
 * 
 * const afterPhysics = pipe(
 *   velocity,
 *   applyGravity(0.05),
 *   applyFriction(0.98),
 *   clampToMaxSpeed(20)
 * )
 * 
 * const jumpVelocity = pipe(
 *   velocity,
 *   add(jump(12))
 * )
 * 
 * const reflected = pipe(
 *   velocity,
 *   reflect({ x: 1, y: 0, z: 0 }) // Bounce off wall facing east
 * )
 */