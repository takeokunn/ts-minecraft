// Distance band for mob spawning around the player (in blocks)
export const MIN_SPAWN_DISTANCE = 16
export const MAX_SPAWN_DISTANCE = 40
export const DESPAWN_DISTANCE = 64

// Mob AABB sizing used by spawn placement and collision resolution.
export const MOB_HALF_WIDTH = 0.3
export const MOB_HALF_HEIGHT = 0.9

// Maximum total mob population before spawning is suppressed
export const MAX_ENTITY_COUNT = 24

// Spawn is attempted every SPAWN_INTERVAL_SECS of real time (throttles CPU cost).
// Previously this was a frame/iteration count (6) on the maintenance lane, which
// made the spawn RATE depend on the lane's cadence (16–48ms/iter) — mobs spawned
// up to ~3x faster under load. 6 × the old assumed 0.05s cadence = 0.3s; gating on
// accumulated real time keeps the spawn rate frame-rate / load independent.
export const SPAWN_INTERVAL_SECS = 0.3

// Hostile mobs only spawn where the block-light level is at or below this
// threshold (vanilla: light ≤ 7). A torch (light 14) lights a wide radius above
// this, so placing torches suppresses hostile spawns — the core "light up your
// base" survival mechanic.
export const HOSTILE_SPAWN_MAX_BLOCK_LIGHT = 7
