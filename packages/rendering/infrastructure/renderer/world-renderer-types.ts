import { Option } from 'effect'
import * as THREE from 'three'
import { ChunkCoord } from '@ts-minecraft/core'
import type { LodLevel } from '../meshing/lod-simplification'

// Local mirrors of frame-budget helpers — duplicated here (not imported from
// `@ts-minecraft/app`) because that direction is forbidden by the package
// dependency graph (`app` already depends on `rendering`). The shapes intentionally
// match `packages/app/application/frame/frame-budget.ts` so the two definitions
// stay in lockstep; if either drifts, the frame-budget tests in
// `packages/app/test/frame-budget.test.ts` will catch it.
// MUST equal `DEFAULT_TARGET_FPS` in `packages/app/application/frame/frame-budget.ts`,
// which since R-perf-3 tracks the game loop's 60 fps emission cap (`TARGET_FRAME_RATE`).
// The frame-budget lockstep tests fail if this drifts from the app-side default.
const RENDERING_DEFAULT_TARGET_FPS = 60
const computeMaxChunkUpdatesPerFrame = (fps: number): number => Math.ceil((8 * fps) / 60)
const computeChunkSyncBudgetMs = (fps: number): number => 240 / fps

// Safety cap: time budget is the real throttle; this prevents an infinite loop if one mesh takes 100ms.
// Only throttles creation — removal of stale chunks is always immediate.
// Derived from the helper at DEFAULT_TARGET_FPS so the cap scales with the target FPS.
export const MAX_CHUNK_UPDATES_PER_FRAME = computeMaxChunkUpdatesPerFrame(RENDERING_DEFAULT_TARGET_FPS)

// Per-frame cap on chunk REMOVALS/disposals. geometry.dispose() triggers a
// synchronous WebGL deleteBuffer on the main thread, so disposing a whole stale
// chunk row at once (a chunk-boundary crossing while moving) stalls the frame
// ("移動しまくるとカクつく"). Half the add cap spreads a boundary-crossing burst
// over a few frames; steady churn (~<1 chunk/frame, load-throttled) is far below
// it so stale chunks never accumulate. Mirrors the budgeted add path.
export const MAX_CHUNK_REMOVALS_PER_FRAME = Math.max(2, Math.ceil(MAX_CHUNK_UPDATES_PER_FRAME / 2))

// Mirrors DIRTY_CHUNK_FLUSH_TIME_BUDGET_MS in frame-maintenance — both pipelines target the same per-frame budget.
// Derived from the helper at DEFAULT_TARGET_FPS so the time budget scales with the target FPS.
export const WORLD_RENDERER_TIME_BUDGET_MS = computeChunkSyncBudgetMs(RENDERING_DEFAULT_TARGET_FPS)

/* c8 ignore next */
export const CHUNK_SYNC_CONCURRENCY = typeof Worker === 'undefined' ? 1 : 2

// Keep the refraction pass lower-resolution than the main canvas to cut GPU fill cost.
export const REFRACTION_RT_WIDTH = 400
export const REFRACTION_RT_HEIGHT = 300

export type ChunkMeshes = {
  opaque: THREE.Mesh & {
    readonly userData: THREE.Mesh['userData'] & {
      readonly chunkCoord?: ChunkCoord
      // FR-3.3: highest non-AIR Y in this chunk (-1 for empty chunks); fallback to CHUNK_HEIGHT when absent.
      readonly chunkMaxY?: number
    }
  }
  water: Option.Option<THREE.Mesh & {
    readonly userData: THREE.Mesh['userData'] & {
      readonly chunkCoord?: ChunkCoord
      readonly chunkMaxY?: number
    }
  }>
  // GLASS and LEAVES faces — rendered with atlas material + alpha blending.
  transparentSolid: Option.Option<THREE.Mesh & {
    readonly userData: THREE.Mesh['userData'] & {
      readonly chunkCoord?: ChunkCoord
      readonly chunkMaxY?: number
    }
  }>
  // FR-3.1: LOD level used to mesh this chunk. Tracked per-mesh so the
  // renderer can detect LOD-band crossings (player movement / settings
  // change) and schedule a re-mesh only for chunks whose LOD has changed.
  readonly lod: LodLevel
}
