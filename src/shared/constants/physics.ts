// Remove invalid import - use plain numbers instead

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

// Physics Time Configuration
export const PHYSICS_TIME_STEP = 1 / 60 // 60 FPS
export const MAX_PHYSICS_SUBSTEPS = 3

// Simple collider interface for shared constants (to avoid domain layer dependency)
export interface SimpleCollider {
  width: number
  height: number
  depth: number
}

// --- Colliders ---
export const PLAYER_COLLIDER: SimpleCollider = {
  width: 0.6,
  height: PLAYER_HEIGHT,
  depth: 0.6,
}

export const BLOCK_COLLIDER: SimpleCollider = {
  width: 1,
  height: 1,
  depth: 1,
}
