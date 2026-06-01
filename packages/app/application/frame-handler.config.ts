import {
  computeMaxDirtyChunkUpdatesPerFrame,
  DEFAULT_TARGET_FPS,
} from './frame/frame-budget'

// Camera eye level offset: player height minus half body height.
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
export const PLAYER_ATTACK_DAMAGE        = 4
export const WOODEN_SWORD_ATTACK_DAMAGE  = 8
export const STONE_SWORD_ATTACK_DAMAGE   = 9
export const IRON_SWORD_ATTACK_DAMAGE    = 12
export const DIAMOND_SWORD_ATTACK_DAMAGE = 16
// Axes deal comparable base damage to swords (vanilla 1.9+: axes have higher
// base but slower attack speed; our cooldown system handles speed separately).
export const WOODEN_AXE_ATTACK_DAMAGE   = 9
export const STONE_AXE_ATTACK_DAMAGE    = 10
export const IRON_AXE_ATTACK_DAMAGE     = 11
export const DIAMOND_AXE_ATTACK_DAMAGE  = 13

// Entity bounding box center is 0.9 units above position.y (half hitbox height)
export const ENTITY_CENTER_Y_OFFSET = 0.9

// FPS threshold above which adaptive quality stops degrading (comfortably above 60Hz on 120Hz display)
export const ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD = 110

// Fallback when the physics surface query fails.
export const FALLBACK_PLAYER_POS = Object.freeze({ x: 0, y: 64, z: 0 } as const)
