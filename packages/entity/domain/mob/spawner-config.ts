// Distance band for mob spawning around the player (in blocks)
export const MIN_SPAWN_DISTANCE = 16
export const MAX_SPAWN_DISTANCE = 40
export const DESPAWN_DISTANCE = 64

// Mob AABB sizing used by spawn placement and collision resolution.
export const MOB_HALF_WIDTH = 0.3
export const MOB_HALF_HEIGHT = 0.9

// Maximum total mob population before spawning is suppressed
export const MAX_ENTITY_COUNT = 24

// Spawn is attempted every N frames (throttles CPU cost)
export const SPAWN_INTERVAL_FRAMES = 6
