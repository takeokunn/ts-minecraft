// 1.18-style multi-noise splines. Inputs in [-1,1]; outputs in world-Y units (FACTOR_SPLINE is dimensionless).
import type { Spline } from './spline'

// Continentalness C -> base Y offset. Ocean / coast / inland / plateau regions.
export const OFFSET_SPLINE: Spline = [
  [-1.0, 32],
  [-0.45, 40],   // deep ocean
  [-0.15, 55],   // shore
  [0.1,  65],    // coast
  [0.3,  75],    // plains
  [0.55, 95],    // inland
  [0.75, 120],   // hills
  [1.0,  140],   // plateau
]

// Erosion E -> factor multiplying jaggedness + pv amplitude. High erosion flattens terrain.
export const FACTOR_SPLINE: Spline = [
  [-1.0, 1.3],   // very jagged
  [-0.5, 1.1],
  [0.0,  0.8],
  [0.4,  0.5],
  [0.8,  0.25],
  [1.0,  0.15],  // very eroded / flat
]

// PV (peaks-and-valleys) -> Y offset contribution. Negative=valleys, positive=peaks.
export const PV_OFFSET: Spline = [
  [-1.0, -25],   // deep valley
  [-0.4, -10],
  [0.0,   0],
  [0.4,  15],
  [1.0,  40],    // tall peak
]

// Erosion E -> jaggedness amplitude multiplier. Suppressed when erosion > 0 (flat terrain).
// Cut hard (15→5, 5→2) because the old amplitude × FACTOR_SPLINE (1.3) gave ±~20 blocks of
// HIGH-FREQUENCY roughness even in mountains: positive jaggedness spiked the surface, negative
// jaggedness dug ~20-block pits that exposed stone — the terrain read as unnatural/spiky
// ('地形生成がおかしい 自然じゃない'). At 5 it still roughens peaks (×1.3 ≈ ±6.5) without
// shredding the landscape; the smooth large-scale shape comes from continentalness/erosion/PV.
export const JAGGED_AMP: Spline = [
  [-1.0, 5],
  [-0.3, 2],
  [0.0,  0],   // suppressed from here on
  [1.0,  0],
]
