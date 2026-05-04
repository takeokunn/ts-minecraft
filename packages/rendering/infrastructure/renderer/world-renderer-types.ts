import { Option } from 'effect'
import * as THREE from 'three'
import { ChunkCoord } from '@ts-minecraft/kernel'

// Safety cap: time budget is the real throttle; this prevents an infinite loop if one mesh takes 100ms.
// Only throttles creation — removal of stale chunks is always immediate.
export const MAX_CHUNK_UPDATES_PER_FRAME = 8

// Mirrors DIRTY_CHUNK_FLUSH_TIME_BUDGET_MS in frame-maintenance — both pipelines target the same per-frame budget.
export const WORLD_RENDERER_TIME_BUDGET_MS = 4

/* c8 ignore next */
export const CHUNK_SYNC_CONCURRENCY = typeof Worker === 'undefined' ? 1 : 2

// Keep the refraction pass lower-resolution than the main canvas to cut GPU fill cost.
export const REFRACTION_RT_WIDTH = 400
export const REFRACTION_RT_HEIGHT = 300

export type ChunkMeshes = {
  opaque: THREE.Mesh & {
    readonly userData: THREE.Mesh['userData'] & {
      readonly chunkCoord?: ChunkCoord
    }
  }
  water: Option.Option<THREE.Mesh & {
    readonly userData: THREE.Mesh['userData'] & {
      readonly chunkCoord?: ChunkCoord
    }
  }>
}
