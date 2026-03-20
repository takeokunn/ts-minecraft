import { WorldId, PlayerId } from '@/shared/kernel'

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
export const FIRST_FRAME_DELTA_SECS = 0.016
