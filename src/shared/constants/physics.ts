import { ColliderComponent } from '../../domain/entities/components'
import { toFloat } from '../utils/math'

/**
 * Physics and movement constants
 */

// Player Physics Constants
export const PLAYER_SPEED = 5
export const SPRINT_MULTIPLIER = 1.6
export const JUMP_FORCE = 7
export const TERMINAL_VELOCITY = 50
export const FRICTION = 0.98
export const GRAVITY = 20
export const DECELERATION = 0.98
export const MIN_VELOCITY_THRESHOLD = 0.001
export const PLAYER_HEIGHT = 1.8

// Collision Detection Constants
export const COLLISION_MARGIN = 0.01
export const MAX_COLLISION_ITERATIONS = 10

// --- Colliders ---
export const PLAYER_COLLIDER: ColliderComponent = {
  width: toFloat(0.6),
  height: toFloat(PLAYER_HEIGHT),
  depth: toFloat(0.6),
}

export const BLOCK_COLLIDER: ColliderComponent = {
  width: toFloat(1),
  height: toFloat(1),
  depth: toFloat(1),
}
