import type { Position, DeltaTimeSecs, Vector3 as Velocity } from '@ts-minecraft/kernel'

export const DEFAULT_GRAVITY = 9.82

export const calculateJumpVelocity = (
  height: number,
  gravity: number = DEFAULT_GRAVITY
): number => {
  if (height <= 0 || gravity <= 0) {
    return 0
  }
  return Math.sqrt(2 * gravity * height)
}

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

export const applyFriction = (
  velocity: Velocity,
  friction: number,
  deltaTime: DeltaTimeSecs
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

export const updatePosition = (
  position: Position,
  velocity: Velocity,
  deltaTime: DeltaTimeSecs
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

export const checkGroundedByDistance = (
  playerY: number,
  groundY: number,
  threshold: number = 0.15
): boolean => {
  const distanceToGround = playerY - groundY
  return distanceToGround >= 0 && distanceToGround <= threshold
}

export const getHorizontalSpeed = (velocity: Velocity): number => {
  return Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
}

export const getTotalSpeed = (velocity: Velocity): number => {
  return Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)
}

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

export const zeroVelocity = (): Velocity => ({ x: 0, y: 0, z: 0 })

export const zeroPosition = (): Position => ({ x: 0, y: 0, z: 0 })

export const addVelocities = (a: Velocity, b: Velocity): Velocity => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
})

export const scaleVelocity = (velocity: Velocity, scalar: number): Velocity => ({
  x: velocity.x * scalar,
  y: velocity.y * scalar,
  z: velocity.z * scalar,
})
