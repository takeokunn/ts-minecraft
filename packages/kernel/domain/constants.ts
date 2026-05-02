import { WorldId, PlayerId, DeltaTimeSecs } from './kernel'

// Canonical location: shared between block-service and chunk-manager.
export const DEFAULT_WORLD_ID = WorldId.make('world-1')

export const DEFAULT_PLAYER_ID = PlayerId.make('player-1')

// Used for the very first frame when no previous timestamp exists (16ms @ 60fps).
export const FIRST_FRAME_DELTA_SECS: DeltaTimeSecs = DeltaTimeSecs.make(0.016)

// Phase 2.1 MC 1.18-aligned. Ocean biome water fills up to this height.
export const SEA_LEVEL = 63

// Phase 2.1 MC 1.18-aligned. Non-ocean lake water surface level.
export const LAKE_LEVEL = 64
