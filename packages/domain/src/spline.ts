// Piecewise-linear spline utilities.
// Pure math primitive — no Effect wrapper, no service dependencies.
// Used by the 1.18-style multi-noise heightmap pipeline.

/** Piecewise-linear spline: sorted ascending by t. Evaluation clamps outside [t_min, t_max]. */
export type ControlPoint = readonly [t: number, value: number]
export type Spline = ReadonlyArray<ControlPoint>

/** Evaluate a spline at t. Returns the endpoint value when t is outside the range. */
export const evaluateSpline = (spline: Spline, t: number): number => {
  const n = spline.length
  if (n === 0) return 0
  const first = spline[0]!
  if (t <= first[0]) return first[1]
  const last = spline[n - 1]!
  if (t >= last[0]) return last[1]
  // Linear scan for the bracket. Splines here have <= 8 control points,
  // so the branch-predictor-friendly linear scan beats a binary search.
  for (let i = 1; i < n; i++) {
    const [t1, v1] = spline[i]!
    if (t <= t1) {
      const [t0, v0] = spline[i - 1]!
      const span = t1 - t0
      // Guard against zero-width segments (duplicate t values).
      if (span === 0) return v1
      return v0 + (v1 - v0) * (t - t0) / span
    }
  }
  // Unreachable given the upper-bound clamp above, but satisfies the type system.
  return last[1]
}
