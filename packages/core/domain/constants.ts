import { WorldId, PlayerId, DeltaTimeSecs } from './kernel'

// Canonical location: shared between block-service and chunk-manager.
export const DEFAULT_WORLD_ID = WorldId.make('world-1')

export const DEFAULT_PLAYER_ID = PlayerId.make('player-1')

// Used for the very first frame when no previous timestamp exists (16ms @ 60fps).
export const FIRST_FRAME_DELTA_SECS: DeltaTimeSecs = DeltaTimeSecs.make(0.016)

// Minecraft's simulation runs at 20 game ticks per second. Per-frame timers that count in
// game ticks must advance by `deltaTime * GAME_TICKS_PER_SEC`, not by 1 per render frame —
// otherwise they run at the display refresh rate (~3x too fast at 60fps).
export const GAME_TICKS_PER_SEC = 20

// Phase 2.1 MC 1.18-aligned. Ocean biome water fills up to this height.
export const SEA_LEVEL = 63

// Phase 2.1 MC 1.18-aligned. Inland lake water surface matches sea level.
export const LAKE_LEVEL = SEA_LEVEL

// Player AABB half-extents — single source of truth used by block-service and game-state.
export const PLAYER_HALF_WIDTH = 0.3   // x and z half-extents
export const PLAYER_HALF_HEIGHT = 0.9  // y half-extent
