import { Effect } from 'effect'
import * as S from 'effect/Schema'
import { Collider } from './components'
import { toFloat } from './common'

// World Generation Constants
export const CHUNK_SIZE = 10
export const CHUNK_HEIGHT = 256
export const WATER_LEVEL = 0
export const WORLD_DEPTH = 5
export const MIN_WORLD_Y = -250

// Internal Constants
// Y_OFFSET is used to map world Y coordinates (which can be negative)
// to array indices (which must be positive).
export const Y_OFFSET = 128

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

// --- Colliders ---
export const PLAYER_COLLIDER = Effect.all({
  width: toFloat(0.6),
  height: toFloat(PLAYER_HEIGHT),
  depth: toFloat(0.6),
}).pipe(Effect.flatMap(S.decode(Collider)))

export const BLOCK_COLLIDER = Effect.all({
  width: toFloat(1),
  height: toFloat(1),
  depth: toFloat(1),
}).pipe(Effect.flatMap(S.decode(Collider)))

// Chunk Loading Constants
export const RENDER_DISTANCE = 2