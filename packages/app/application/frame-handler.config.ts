import {
  computeMaxDirtyChunkUpdatesPerFrame,
  DEFAULT_TARGET_FPS,
} from './frame/frame-budget'

// Camera eye level offset, measured from the player AABB *center* (playerPos.y).
// Vanilla eye height is 1.62 blocks above the feet; the AABB center sits
// PLAYER_HALF_HEIGHT (0.9) above the feet, so the offset is 1.62 − 0.9 = 0.72.
export const EYE_LEVEL_OFFSET = 0.72

export const TRADE_DISTANCE = 4

export const TRADE_OPEN_KEY = 'KeyT'
export const TRADE_NEXT_KEY = 'ArrowDown'
export const TRADE_PREV_KEY = 'ArrowUp'
export const TRADE_EXECUTE_KEY = 'Enter'

// Derived from the helper at DEFAULT_TARGET_FPS so the frame cap scales with the target FPS.
export const MAX_DIRTY_CHUNK_UPDATES_PER_FRAME = computeMaxDirtyChunkUpdatesPerFrame(DEFAULT_TARGET_FPS)

// 2 on platforms with Web Workers, 1 otherwise.
export const DIRTY_CHUNK_FLUSH_CONCURRENCY = typeof Worker === 'undefined' ? 1 : 2

export const REDSTONE_TICK_INTERVAL_SECS = 0.05
export const FLUID_TICK_INTERVAL_SECS = 0.05

export const REDSTONE_PLACE_WIRE_KEY   = 'KeyR'
export const REDSTONE_PLACE_LEVER_KEY  = 'KeyL'
export const REDSTONE_PLACE_BUTTON_KEY = 'KeyB'
export const REDSTONE_PLACE_TORCH_KEY  = 'KeyO'
export const REDSTONE_PLACE_PISTON_KEY = 'KeyP'

export const REDSTONE_TOGGLE_LEVER_KEY  = 'KeyY'
export const REDSTONE_PRESS_BUTTON_KEY  = 'KeyU'
export const REDSTONE_TOGGLE_TORCH_KEY  = 'KeyI'

// In-game unequip: removes the first occupied armor slot back into the inventory.
// KeyG is free among the existing redstone/trade key bindings.
export const UNEQUIP_ARMOR_KEY = 'KeyG'

export const PLAYER_ATTACK_REACH        = 3.5
export const PLAYER_ATTACK_RADIUS       = 0.9
// Entity bounding box center is 0.9 units above position.y (half hitbox height)
export const ENTITY_CENTER_Y_OFFSET = 0.9

// FPS at/above which adaptive quality leaves the user's settings alone. This must be a
// STRUGGLE line, not an aspirational ceiling: the game loop is capped near 60 fps and most
// displays are 60 Hz / vsync-locked, so a value above ~60 (the old 110) made `fps < threshold`
// true for essentially everyone — the default-on adaptive mode then degraded every player to
// the quality floor (low + render distance 4) with no upgrade path, regardless of their
// hardware. 50 keeps full quality for anyone holding a smooth ~50-60 fps and only sheds
// quality when the frame rate genuinely drops below that.
export const ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD = 50

// Fallback when the physics surface query fails.
export const FALLBACK_PLAYER_POS = Object.freeze({ x: 0, y: 64, z: 0 } as const)
