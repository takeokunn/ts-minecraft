import { Effect, Match, Option, Duration } from 'effect'
import { CameraState, InputState, Player, Velocity } from '@/core/components'
import { queries, QueryProfiler } from '@/core/queries'
import { DECELERATION, JUMP_FORCE, MIN_VELOCITY_THRESHOLD, PLAYER_SPEED, SPRINT_MULTIPLIER } from '@/domain/world-constants'
import { World } from '@/runtime/services'
import { Float, toFloat } from '@/core/common'
import { SystemContext } from './core/scheduler'
import { globalCommunicationHub } from './core/system-communication'

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
    return { newDy: JUMP_FORCE, newIsGrounded: false }
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

export const playerMovementSystem = (context?: SystemContext) => Effect.gen(function* ($) {
  const startTime = Date.now()
  const world = yield* $(World)
  const { entities, components } = yield* $(world.querySoA(queries.playerMovement))
  const { player, inputState, velocity, cameraState } = components

  // Batch movement updates for better performance
  const movementUpdates: Array<{
    entityId: any
    velocity: Velocity
    player: Player
    hasInput: boolean
  }> = []

  // Process all entities in a single loop for better cache performance
  for (let i = 0; i < entities.length; i++) {
    const entityId = entities[i]
    const currentPlayer = player[i]
    const currentInputState = inputState[i]
    const currentVelocity = velocity[i]
    const currentCameraState = cameraState[i]

    const { newDy, newIsGrounded } = calculateVerticalVelocity(
      currentPlayer.isGrounded,
      currentInputState.jump,
      currentVelocity.dy,
    )

    const hasHorizontalInput =
      currentInputState.forward ||
      currentInputState.backward ||
      currentInputState.left ||
      currentInputState.right

    const { dx, dz } = Match.value(hasHorizontalInput).pipe(
      Match.when(true, () => calculateHorizontalVelocity(currentInputState, currentCameraState)),
      Match.orElse(() => applyDeceleration(currentVelocity)),
    )

    movementUpdates.push({
      entityId,
      velocity: new Velocity({ dx, dy: newDy, dz }),
      player: new Player({ isGrounded: newIsGrounded }),
      hasInput: hasHorizontalInput || currentInputState.jump,
    })
  }

  // Apply all movement updates
  yield* $(
    Effect.forEach(
      movementUpdates,
      (update) =>
        Effect.gen(function* ($) {
          yield* $(world.updateComponent(update.entityId, 'velocity', update.velocity))
          yield* $(world.updateComponent(update.entityId, 'player', update.player))
        }),
      { concurrency: 'inherit', discard: true },
    ),
  )

  // Send movement notifications for entities that had input
  const entitiesWithInput = movementUpdates.filter(u => u.hasInput)
  if (entitiesWithInput.length > 0) {
    yield* $(
      globalCommunicationHub.sendMessage(
        'player_moved',
        {
          entities: entitiesWithInput.map(u => u.entityId),
          frameId: context?.frameId || 0,
        },
        {
          sender: 'player-movement',
          priority: 'normal',
          frameId: context?.frameId || 0,
        }
      )
    )
  }

  // Record performance metrics
  const executionTime = Date.now() - startTime
  QueryProfiler.record('player_movement_system', {
    executionTime,
    entitiesScanned: entities.length,
    entitiesMatched: movementUpdates.length,
    cacheHits: 0,
    cacheMisses: 0,
  })
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
   * Apply movement impulse
   */
  applyMovementImpulse: (entityId: any, impulse: { x: number; y: number; z: number }) =>
    Effect.gen(function* ($) {
      const world = yield* $(World)
      const velocity = yield* $(world.getComponent(entityId, 'velocity'))
      
      if (velocity) {
        const newVelocity = new Velocity({
          dx: toFloat(velocity.dx + impulse.x),
          dy: toFloat(velocity.dy + impulse.y),
          dz: toFloat(velocity.dz + impulse.z),
        })
        
        yield* $(world.updateComponent(entityId, 'velocity', newVelocity))
      }
    }),
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
