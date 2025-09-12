/**
 * Domain-specific world constants
 *
 * These constants are specific to the domain layer's understanding of world mechanics.
 * Physical world constants are defined in /constants/world
 */

// Import shared world constants
import {
  CHUNK_SIZE as _CHUNK_SIZE,
  CHUNK_HEIGHT as _CHUNK_HEIGHT,
  WATER_LEVEL as _WATER_LEVEL,
  WORLD_DEPTH as _WORLD_DEPTH,
  MIN_WORLD_Y as _MIN_WORLD_Y,
  Y_OFFSET as _Y_OFFSET,
  RENDER_DISTANCE as _RENDER_DISTANCE,
  NOISE_SCALE as _NOISE_SCALE,
  TERRAIN_HEIGHT_MULTIPLIER as _TERRAIN_HEIGHT_MULTIPLIER,
  CAVE_THRESHOLD as _CAVE_THRESHOLD,
} from '@shared/constants/world'

// Import physics constants
import {
  PLAYER_SPEED as _PLAYER_SPEED,
  SPRINT_MULTIPLIER as _SPRINT_MULTIPLIER,
  JUMP_FORCE as _JUMP_FORCE,
  TERMINAL_VELOCITY as _TERMINAL_VELOCITY,
  FRICTION as _FRICTION,
  GRAVITY as _GRAVITY,
  DECELERATION as _DECELERATION,
  MIN_VELOCITY_THRESHOLD as _MIN_VELOCITY_THRESHOLD,
  PLAYER_HEIGHT as _PLAYER_HEIGHT,
  PLAYER_COLLIDER as _PLAYER_COLLIDER,
  BLOCK_COLLIDER as _BLOCK_COLLIDER,
} from '@shared/constants/physics'

// Re-export for external consumption
export const CHUNK_SIZE = _CHUNK_SIZE
export const CHUNK_HEIGHT = _CHUNK_HEIGHT
export const WATER_LEVEL = _WATER_LEVEL
export const WORLD_DEPTH = _WORLD_DEPTH
export const MIN_WORLD_Y = _MIN_WORLD_Y
export const Y_OFFSET = _Y_OFFSET
export const RENDER_DISTANCE = _RENDER_DISTANCE
export const NOISE_SCALE = _NOISE_SCALE
export const TERRAIN_HEIGHT_MULTIPLIER = _TERRAIN_HEIGHT_MULTIPLIER
export const CAVE_THRESHOLD = _CAVE_THRESHOLD

export const PLAYER_SPEED = _PLAYER_SPEED
export const SPRINT_MULTIPLIER = _SPRINT_MULTIPLIER
export const JUMP_FORCE = _JUMP_FORCE
export const TERMINAL_VELOCITY = _TERMINAL_VELOCITY
export const FRICTION = _FRICTION
export const GRAVITY = _GRAVITY
export const DECELERATION = _DECELERATION
export const MIN_VELOCITY_THRESHOLD = _MIN_VELOCITY_THRESHOLD
export const PLAYER_HEIGHT = _PLAYER_HEIGHT
export const PLAYER_COLLIDER = _PLAYER_COLLIDER
export const BLOCK_COLLIDER = _BLOCK_COLLIDER

// Domain-specific derived constants
export const CHUNK_VOLUME = _CHUNK_SIZE * _CHUNK_SIZE * _CHUNK_HEIGHT
export const WORLD_HEIGHT_RANGE = _CHUNK_HEIGHT + Math.abs(_MIN_WORLD_Y)
export const SURFACE_LEVEL = _WATER_LEVEL + 1
export const UNDERGROUND_LEVEL = _WATER_LEVEL - 10
