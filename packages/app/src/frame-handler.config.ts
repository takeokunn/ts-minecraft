/** Camera eye level offset: player height minus half body height */
export const EYE_LEVEL_OFFSET = 0.72

/** Maximum distance at which a villager trade UI can be opened */
export const TRADE_DISTANCE = 4

/** Keybindings for the trade UI */
export const TRADE_OPEN_KEY = 'KeyT'
export const TRADE_NEXT_KEY = 'ArrowDown'
export const TRADE_PREV_KEY = 'ArrowUp'
export const TRADE_EXECUTE_KEY = 'Enter'

/** Maximum number of dirty chunk re-meshes processed per frame */
export const MAX_DIRTY_CHUNK_UPDATES_PER_FRAME = 4

/** Parallel chunk flush concurrency — 2 on platforms with Web Workers, 1 otherwise */
export const DIRTY_CHUNK_FLUSH_CONCURRENCY = typeof Worker === 'undefined' ? 1 : 2

/** Redstone and fluid tick rates */
export const REDSTONE_TICK_INTERVAL_SECS = 0.05
export const FLUID_TICK_INTERVAL_SECS = 0.05

/** Keybindings for redstone component placement */
export const REDSTONE_PLACE_WIRE_KEY   = 'KeyR'
export const REDSTONE_PLACE_LEVER_KEY  = 'KeyL'
export const REDSTONE_PLACE_BUTTON_KEY = 'KeyB'
export const REDSTONE_PLACE_TORCH_KEY  = 'KeyO'
export const REDSTONE_PLACE_PISTON_KEY = 'KeyP'

/** Keybindings for redstone component interaction */
export const REDSTONE_TOGGLE_LEVER_KEY  = 'KeyY'
export const REDSTONE_PRESS_BUTTON_KEY  = 'KeyU'
export const REDSTONE_TOGGLE_TORCH_KEY  = 'KeyI'

/** Player melee combat parameters */
export const PLAYER_ATTACK_REACH        = 3.5
export const PLAYER_ATTACK_RADIUS       = 0.9
export const PLAYER_ATTACK_DAMAGE       = 4
export const WOODEN_SWORD_ATTACK_DAMAGE = 8

/** Fallback spawn position used when the physics surface query fails */
export const FALLBACK_PLAYER_POS = Object.freeze({ x: 0, y: 64, z: 0 } as const)
