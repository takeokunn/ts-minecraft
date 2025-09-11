/**
 * Domain-specific world constants
 *
 * These constants are specific to the domain layer's understanding of world mechanics.
 * Physical world constants are defined in /constants/world
 */

// Re-export shared world constants
export {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  WATER_LEVEL,
  WORLD_DEPTH,
  MIN_WORLD_Y,
  Y_OFFSET,
  RENDER_DISTANCE,
  NOISE_SCALE,
  TERRAIN_HEIGHT_MULTIPLIER,
  CAVE_THRESHOLD,
} from '@shared/constants/world'

// Re-export physics constants for domain convenience
export {
  PLAYER_SPEED,
  SPRINT_MULTIPLIER,
  JUMP_FORCE,
  TERMINAL_VELOCITY,
  FRICTION,
  GRAVITY,
  DECELERATION,
  MIN_VELOCITY_THRESHOLD,
  PLAYER_HEIGHT,
  PLAYER_COLLIDER,
  BLOCK_COLLIDER,
} from '@shared/constants/physics'

// Domain-specific derived constants
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
export const WORLD_HEIGHT_RANGE = CHUNK_HEIGHT + Math.abs(MIN_WORLD_Y)
export const SURFACE_LEVEL = WATER_LEVEL + 1
export const UNDERGROUND_LEVEL = WATER_LEVEL - 10
