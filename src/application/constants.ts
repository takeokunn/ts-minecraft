import { WorldId, PlayerId, DeltaTimeSecs } from '@/shared/kernel'

/**
 * Default world ID — single-world game assumption.
 * Canonical location for the shared constant across block-service and chunk-manager.
 */
export const DEFAULT_WORLD_ID = WorldId.make('world-1')

/**
 * Default player ID — single-player game assumption.
 */
export const DEFAULT_PLAYER_ID = PlayerId.make('player-1')

/** Delta time used for the very first frame when no previous timestamp exists (16ms @ 60fps) */
export const FIRST_FRAME_DELTA_SECS: DeltaTimeSecs = DeltaTimeSecs.make(0.016)

/** Sea level Y coordinate — water fills ocean biome areas up to this height */
export const SEA_LEVEL = 48

/** Inland lake water surface level — lakes fill up to this height in non-ocean biomes */
export const LAKE_LEVEL = 62
