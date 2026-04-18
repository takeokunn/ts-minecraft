/**
 * Piecewise-linear splines defining the 1.18-style multi-noise heightmap.
 * Tuned spiritually close to vanilla — not data-driven from Java Edition JSON.
 *
 * Inputs are assumed to be in [-1, 1] (the standard range of the underlying noise fields).
 * Outputs are in world-Y units (except FACTOR_SPLINE which is a dimensionless multiplier).
 */

import type { Spline } from '@/domain/spline'

/** Continentalness C in [-1, 1] -> base Y offset. Ocean / coast / inland / plateau regions. */
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

/** Erosion E in [-1, 1] -> factor scalar multiplying jaggedness + pv amplitude.
 *  High erosion flattens terrain; low erosion keeps it jagged. */
export const FACTOR_SPLINE: Spline = [
  [-1.0, 1.3],   // very jagged
  [-0.5, 1.1],
  [0.0,  0.8],
  [0.4,  0.5],
  [0.8,  0.25],
  [1.0,  0.15],  // very eroded / flat
]

/** PV (peaks-and-valleys) in [-1, 1] -> offset contribution to Y.
 *  Negative pv -> valleys (subtract from surface). Positive pv -> peaks. */
export const PV_OFFSET: Spline = [
  [-1.0, -25],   // deep valley
  [-0.4, -10],
  [0.0,   0],
  [0.4,  15],
  [1.0,  40],    // tall peak
]

/** Erosion E in [-1, 1] -> jaggedness amplitude multiplier.
 *  Only apply jaggedness when erosion is low (< 0). Suppress in flat regions. */
export const JAGGED_AMP: Spline = [
  [-1.0, 15],
  [-0.3,  5],
  [0.0,   0],   // suppressed from here on
  [1.0,   0],
]
