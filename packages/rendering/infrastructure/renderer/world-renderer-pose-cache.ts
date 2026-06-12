// FR-3.6: tolerance-based camera-pose cache for frustum culling.
//
// The strict-equality cache miss-fired on sub-pixel jitter
// (qx changing by 1e-7 invalidated the cache and forced a full rebuild of the
// frustum + N AABB intersect tests every frame). Tolerance buckets eliminate
// that miss path while leaving meaningful changes (any movement that visibly
// shifts the visible chunk set) cache-busting as before.
//
// Tolerance values (chosen empirically + motivation):
//   - position : 1e-3 (1 mm)        — sub-block precision; chunks are 16×16 units
//                                      so 1 mm cannot cross any AABB boundary.
//   - quaternion: 1e-4 (~0.011°)     — at FOV 75° / 1080 px, this is well below
//                                      one pixel of yaw — invisible to the eye
//                                      and cannot flip a chunk's "in/out" state.
//   - projection (p0/p5/p10/p14): 1e-4
//                                    — projection elements are only touched by
//                                      explicit setting changes (FOV, aspect,
//                                      near/far). Tolerance protects against
//                                      drift from updateProjectionMatrix() float
//                                      round-trips.

export type CameraPoseCache = {
  x: number
  y: number
  z: number
  qx: number
  qy: number
  qz: number
  qw: number
  p0: number
  p5: number
  p10: number
  p14: number
}

export const POSE_POSITION_TOLERANCE = 1e-3
export const POSE_QUATERNION_TOLERANCE = 1e-4
export const POSE_PROJECTION_TOLERANCE = 1e-4

// Sentinel: pose snapshot that compares "different" against any real camera. Used
// as the initial cache so the first cull always runs.
export const initialPoseCache = (): CameraPoseCache => ({
  x: NaN, y: NaN, z: NaN,
  qx: NaN, qy: NaN, qz: NaN, qw: NaN,
  p0: NaN, p5: NaN, p10: NaN, p14: NaN,
})

// Overwrite an existing CameraPoseCache's fields in place. Used by the frustum-culling
// hot path to fill a reusable scratch object every frame instead of allocating a fresh
// 11-field literal (which churns the nursery whenever the camera moves).
export const writeCameraPose = (
  out: CameraPoseCache,
  x: number, y: number, z: number,
  qx: number, qy: number, qz: number, qw: number,
  p0: number, p5: number, p10: number, p14: number,
): void => {
  out.x = x; out.y = y; out.z = z
  out.qx = qx; out.qy = qy; out.qz = qz; out.qw = qw
  out.p0 = p0; out.p5 = p5; out.p10 = p10; out.p14 = p14
}

// NaN-safe: NaN-anything returns false (>=, <=), which is what we want — any
// finite delta against a NaN sentinel triggers a cache miss. Conversely, a NaN
// in the *current* pose (Infinity/NaN ingress from a misconfigured camera)
// also reports "changed" so we re-rebuild the frustum (fail-open on bad data).
//
// The naive `Math.abs(a-b) > tol` route mishandles NaN via JS's `NaN - NaN = NaN`
// and `NaN > tol = false` — that would falsely classify NaN-vs-NaN as "same"
// and skip culling forever. Hence the explicit isNaN guard.
const diffExceeds = (a: number, b: number, tol: number): boolean => {
  if (Number.isNaN(a) || Number.isNaN(b)) return true
  // Infinity-anything: Infinity - Infinity = NaN, Infinity - finite = ±Infinity.
  // Both make `> tol` return true, which is the correct "changed" behavior.
  const d = a - b
  return d > tol || d < -tol
}

export const isCameraPoseSimilar = (
  a: CameraPoseCache,
  b: CameraPoseCache,
  posTol: number = POSE_POSITION_TOLERANCE,
  rotTol: number = POSE_QUATERNION_TOLERANCE,
  projTol: number = POSE_PROJECTION_TOLERANCE,
): boolean =>
  !diffExceeds(a.x, b.x, posTol) &&
  !diffExceeds(a.y, b.y, posTol) &&
  !diffExceeds(a.z, b.z, posTol) &&
  !diffExceeds(a.qx, b.qx, rotTol) &&
  !diffExceeds(a.qy, b.qy, rotTol) &&
  !diffExceeds(a.qz, b.qz, rotTol) &&
  !diffExceeds(a.qw, b.qw, rotTol) &&
  !diffExceeds(a.p0, b.p0, projTol) &&
  !diffExceeds(a.p5, b.p5, projTol) &&
  !diffExceeds(a.p10, b.p10, projTol) &&
  !diffExceeds(a.p14, b.p14, projTol)
