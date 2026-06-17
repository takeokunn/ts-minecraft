import { blockTypeToIndex } from '@ts-minecraft/core'

// Single source of truth for transparent block IDs used by the meshing pipeline.
// Fluid IDs (WATER) use the water ShaderMaterial with ripple/refraction effects.
// Transparent-solid IDs (GLASS, LEAVES) use the atlas material + alpha blending.
// Array forms are sent with each worker message; Set forms are used in the synchronous fallback.
export const TRANSPARENT_IDS_ARRAY: readonly number[] = [blockTypeToIndex('WATER')]
export const TRANSPARENT_IDS_SET = new Set(TRANSPARENT_IDS_ARRAY)
export const TRANSPARENT_SOLID_IDS_ARRAY: readonly number[] = [
  blockTypeToIndex('GLASS'),
  blockTypeToIndex('LEAVES'),
]
export const TRANSPARENT_SOLID_IDS_SET = new Set(TRANSPARENT_SOLID_IDS_ARRAY)

export const MESHING_WORKER_TIMEOUT = '3 seconds'

// Circuit breaker: how many CONSECUTIVE worker failures (timeouts or worker errors) are
// tolerated before the pool is permanently disabled and all meshing falls back to the
// synchronous main-thread path. A single transient timeout (a GC pause, a momentarily
// slow chunk) must NOT permanently route every future chunk mesh onto the main thread —
// that turns one hiccup into a permanent frame-hitching cliff. Any success resets the
// count, so only a genuinely broken pool (e.g. a worker script error, which rejects
// immediately) trips the breaker.
export const MESHING_WORKER_FAILURE_THRESHOLD = 3

export const computeMeshingWorkerCountFromHardwareConcurrency = (hardwareConcurrency: number): number => {
  if (!Number.isFinite(hardwareConcurrency) || hardwareConcurrency <= 2) {
    return 1
  }

  return Math.max(1, Math.min(3, Math.floor(hardwareConcurrency / 2)))
}

export const computeMeshingWorkerCount = (): number => {
  const hardwareConcurrency =
    typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
      ? navigator.hardwareConcurrency
      : 2

  return computeMeshingWorkerCountFromHardwareConcurrency(hardwareConcurrency)
}
