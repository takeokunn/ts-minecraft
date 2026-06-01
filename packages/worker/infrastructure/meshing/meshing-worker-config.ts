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
