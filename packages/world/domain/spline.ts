// Piecewise-linear spline utilities.
// Pure math primitive — no Effect wrapper, no service dependencies.
// Used by the 1.18-style multi-noise heightmap pipeline.

// Caller must keep control points sorted ascending by t — evaluateSpline clamps outside [t_min, t_max].
export type ControlPoint = readonly [t: number, value: number]
export type Spline = ReadonlyArray<ControlPoint>

type NonEmptySpline = readonly [ControlPoint, ...ReadonlyArray<ControlPoint>]

const isNonEmptySpline = (spline: Spline): spline is NonEmptySpline =>
  spline.length > 0

const lastControlPoint = (spline: NonEmptySpline): ControlPoint =>
  spline.slice(-1)[0] ?? spline[0]

const interpolateSegment = (
  [t0, v0]: ControlPoint,
  [t1, v1]: ControlPoint,
  t: number,
): number => {
  const span = t1 - t0
  return v0 + (v1 - v0) * (t - t0) / span
}

// Returns the endpoint value when t is outside the spline range (clamped, not extrapolated).
export const evaluateSpline = (spline: Spline, t: number): number => {
  if (!isNonEmptySpline(spline)) return 0
  const first = spline[0]
  if (t <= first[0]) return first[1]
  const last = lastControlPoint(spline)

  if (t < last[0]) {
    let start = first
    for (const end of spline.slice(1)) {
      if (t <= end[0]) return interpolateSegment(start, end, t)
      start = end
    }
  }

  return last[1]
}
