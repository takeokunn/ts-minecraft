import { Effect, Duration } from 'effect'
import { CameraState, InputState, Player, Velocity } from '@/domain/entities/components'
import { DECELERATION, JUMP_FORCE, MIN_VELOCITY_THRESHOLD, PLAYER_SPEED, SPRINT_MULTIPLIER } from '@/domain/world-constants'
// Removed direct service dependency - commands should be data-only
import { Float, toFloat } from '@/domain/value-objects/common'
// Removed unused import - commands should be pure data structures

// Command interface for CQRS pattern
export interface PlayerMovementCommand {
  readonly entityId: string
  readonly position: { x: number; y: number; z: number }
  readonly velocity: { dx: number; dy: number; dz: number }
  readonly inputState: InputState
  readonly cameraState: CameraState
  readonly deltaTime: number
  readonly timestamp: number
}

export const calculateHorizontalVelocity = (
  input: Pick<InputState, 'forward' | 'backward' | 'left' | 'right' | 'sprint'>,
  camera: Pick<CameraState, 'yaw'>,
): { dx: Float; dz: Float } => {
  const speed = input.sprint ? PLAYER_SPEED * SPRINT_MULTIPLIER : PLAYER_SPEED
  const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const moveZ = (input.backward ? 1 : 0) - (input.forward ? 1 : 0)

  if (moveX === 0 && moveZ === 0) {
    return { dx: toFloat(0), dz: toFloat(0) }
  }

  // Normalize diagonal movement
  const magnitude = Math.sqrt(moveX * moveX + moveZ * moveZ)
  const normalizedX = (moveX / magnitude) * speed
  const normalizedZ = (moveZ / magnitude) * speed

  // Apply camera rotation
  const sinYaw = Math.sin(camera.yaw)
  const cosYaw = Math.cos(camera.yaw)
  const dx = toFloat(normalizedX * cosYaw - normalizedZ * sinYaw)
  const dz = toFloat(normalizedX * sinYaw + normalizedZ * cosYaw)

  return { dx, dz }
}

export const calculateVerticalVelocity = (
  isGrounded: boolean,
  jumpPressed: boolean,
  currentDy: Float,
): { newDy: Float; newIsGrounded: boolean } => {
  if (jumpPressed && isGrounded) {
    return { newDy: toFloat(JUMP_FORCE), newIsGrounded: false }
  }
  return { newDy: currentDy, newIsGrounded: isGrounded }
}

const clampToZero = (value: number): Float => {
  if (!Number.isFinite(value)) {
    return toFloat(0)
  }
  return toFloat(Math.abs(value) < MIN_VELOCITY_THRESHOLD ? 0 : value)
}

export const applyDeceleration = (velocity: Pick<Velocity, 'dx' | 'dz'>): Pick<Velocity, 'dx' | 'dz'> => {
  const dx = clampToZero(velocity.dx * DECELERATION)
  const dz = clampToZero(velocity.dz * DECELERATION)
  return { dx, dz }
}

export const playerMovementSystem = () => Effect.gen(function* () {
  // For now, create a simplified system that focuses on direct world interaction
  // In a full implementation, this would query entities with proper ECS integration
  
  return Effect.void // Placeholder - would contain actual entity querying logic
})

/**
 * Player movement utilities
 */
export const PlayerMovementUtils = {
  /**
   * Calculate movement speed based on terrain and modifiers
   */
  calculateMovementSpeed: (baseSpeed: number, modifiers: {
    isGrounded: boolean
    isSprinting: boolean
    terrainMultiplier?: number
    speedBoost?: number
  }) => {
    let speed = baseSpeed
    
    if (modifiers.isSprinting) {
      speed *= SPRINT_MULTIPLIER
    }
    
    if (!modifiers.isGrounded) {
      speed *= 0.3 // Air movement penalty
    }
    
    if (modifiers.terrainMultiplier) {
      speed *= modifiers.terrainMultiplier
    }
    
    if (modifiers.speedBoost) {
      speed += modifiers.speedBoost
    }
    
    return speed
  },

  /**
   * Check if player can jump
   */
  canJump: (player: Player, inputState: InputState) => {
    return player.isGrounded && inputState.jump
  },

  /**
   * Get movement direction vector
   */
  getMovementDirection: (inputState: InputState) => {
    const moveX = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0)
    const moveZ = (inputState.backward ? 1 : 0) - (inputState.forward ? 1 : 0)
    
    return { x: moveX, z: moveZ }
  },

  /**
   * Check if player is moving
   */
  isPlayerMoving: (velocity: Velocity, threshold = MIN_VELOCITY_THRESHOLD) => {
    return Math.abs(velocity.dx) > threshold || 
           Math.abs(velocity.dz) > threshold
  },

  /**
   * Calculate movement impulse (pure function - no side effects in commands)
   */
  calculateMovementImpulse: (
    currentVelocity: Pick<Velocity, 'dx' | 'dy' | 'dz'>,
    impulse: { x: number; y: number; z: number }
  ): Pick<Velocity, 'dx' | 'dy' | 'dz'> => {
    return {
      dx: toFloat(currentVelocity.dx + impulse.x),
      dy: toFloat(currentVelocity.dy + impulse.y),
      dz: toFloat(currentVelocity.dz + impulse.z),
    }
  },
}

/**
 * Enhanced movement calculations with smoothing
 */
export const smoothedMovementCalculation = {
  /**
   * Apply smooth acceleration/deceleration
   */
  smoothVelocityChange: (
    currentVelocity: Pick<Velocity, 'dx' | 'dz'>,
    targetVelocity: Pick<Velocity, 'dx' | 'dz'>,
    deltaTime: number,
    acceleration = 20.0
  ): Pick<Velocity, 'dx' | 'dz'> => {
    const maxChange = acceleration * deltaTime
    
    const dx = currentVelocity.dx + Math.sign(targetVelocity.dx - currentVelocity.dx) * 
                Math.min(maxChange, Math.abs(targetVelocity.dx - currentVelocity.dx))
    
    const dz = currentVelocity.dz + Math.sign(targetVelocity.dz - currentVelocity.dz) * 
                Math.min(maxChange, Math.abs(targetVelocity.dz - currentVelocity.dz))
    
    return {
      dx: toFloat(dx),
      dz: toFloat(dz),
    }
  },

  /**
   * Calculate smooth rotation for camera following
   */
  smoothCameraFollow: (
    currentYaw: number,
    targetYaw: number,
    deltaTime: number,
    rotationSpeed = 5.0
  ): number => {
    const maxRotation = rotationSpeed * deltaTime
    const deltaYaw = targetYaw - currentYaw
    
    // Handle wrap-around
    const normalizedDelta = ((deltaYaw + Math.PI) % (2 * Math.PI)) - Math.PI
    
    const clampedDelta = Math.sign(normalizedDelta) * Math.min(maxRotation, Math.abs(normalizedDelta))
    
    return currentYaw + clampedDelta
  },
}

/**
 * Player movement system configuration
 */
export const playerMovementSystemConfig = {
  id: 'player-movement',
  name: 'Player Movement System',
  priority: 'high' as const,
  phase: 'update' as const,
  dependencies: ['input-polling'],
  conflicts: [],
  maxExecutionTime: Duration.millis(4),
  enableProfiling: true,
}
