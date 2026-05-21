import { describe, expect, it } from 'vitest'
import {
  POSE_POSITION_TOLERANCE,
  POSE_QUATERNION_TOLERANCE,
  POSE_PROJECTION_TOLERANCE,
  initialPoseCache,
  isCameraPoseSimilar,
  type CameraPoseCache,
} from '../infrastructure/renderer/world-renderer-pose-cache'

// Baseline pose used by the tests below — represents a camera looking down -Z
// with an identity-ish quaternion and a default perspective projection.
const baselinePose = (): CameraPoseCache => ({
  x: 0, y: 64, z: 0,
  qx: 0, qy: 0, qz: 0, qw: 1,
  p0: 1.5, p5: 2.0, p10: -1.001, p14: -0.2,
})

describe('FR-3.6 world-renderer-pose-cache', () => {
  // -----------------------------------------------------------------------
  // Initial / sentinel behavior
  // -----------------------------------------------------------------------
  it('initialPoseCache always reports as changed against any real pose (NaN sentinel)', () => {
    const sentinel = initialPoseCache()
    expect(isCameraPoseSimilar(sentinel, baselinePose())).toBe(false)
    // NaN-vs-NaN must NOT be reported as "similar" — otherwise the first frame
    // after init would skip culling entirely.
    expect(isCameraPoseSimilar(sentinel, sentinel)).toBe(false)
  })

  // -----------------------------------------------------------------------
  // Position tolerance (1 mm)
  // -----------------------------------------------------------------------
  it('treats sub-millimeter position jitter as cache hit', () => {
    const a = baselinePose()
    const b = { ...a, x: a.x + POSE_POSITION_TOLERANCE * 0.5 }
    expect(isCameraPoseSimilar(a, b)).toBe(true)
  })

  it('detects position changes that exceed the position tolerance', () => {
    const a = baselinePose()
    const b = { ...a, z: a.z + POSE_POSITION_TOLERANCE * 10 }
    expect(isCameraPoseSimilar(a, b)).toBe(false)
  })

  it('detects per-axis position changes independently (x, y, z all check)', () => {
    const a = baselinePose()
    const dx = { ...a, x: a.x + 0.1 }
    const dy = { ...a, y: a.y + 0.1 }
    const dz = { ...a, z: a.z + 0.1 }
    expect(isCameraPoseSimilar(a, dx)).toBe(false)
    expect(isCameraPoseSimilar(a, dy)).toBe(false)
    expect(isCameraPoseSimilar(a, dz)).toBe(false)
  })

  // -----------------------------------------------------------------------
  // Quaternion tolerance (~0.011 deg)
  // -----------------------------------------------------------------------
  it('treats sub-tolerance quaternion drift as cache hit', () => {
    const a = baselinePose()
    const b = { ...a, qx: a.qx + POSE_QUATERNION_TOLERANCE * 0.5 }
    expect(isCameraPoseSimilar(a, b)).toBe(true)
  })

  it('detects quaternion deltas that exceed the rotation tolerance', () => {
    const a = baselinePose()
    const b = { ...a, qy: a.qy + POSE_QUATERNION_TOLERANCE * 10 }
    expect(isCameraPoseSimilar(a, b)).toBe(false)
  })

  // -----------------------------------------------------------------------
  // Projection tolerance — guards against FOV / aspect / near-far drift
  // -----------------------------------------------------------------------
  it('treats sub-tolerance projection element drift as cache hit', () => {
    const a = baselinePose()
    const b = { ...a, p0: a.p0 + POSE_PROJECTION_TOLERANCE * 0.5 }
    expect(isCameraPoseSimilar(a, b)).toBe(true)
  })

  it('detects projection element changes (e.g. FOV change rebuilds p0/p5)', () => {
    const a = baselinePose()
    const b = { ...a, p0: a.p0 + POSE_PROJECTION_TOLERANCE * 10 }
    expect(isCameraPoseSimilar(a, b)).toBe(false)
  })

  // -----------------------------------------------------------------------
  // NaN / Infinity safety — defends against bad camera ingress
  // -----------------------------------------------------------------------
  it('reports cache miss when current pose contains NaN', () => {
    const a = baselinePose()
    const b: CameraPoseCache = { ...a, qx: Number.NaN }
    expect(isCameraPoseSimilar(a, b)).toBe(false)
  })

  it('reports cache miss when current pose contains Infinity', () => {
    const a = baselinePose()
    const b: CameraPoseCache = { ...a, x: Number.POSITIVE_INFINITY }
    expect(isCameraPoseSimilar(a, b)).toBe(false)
  })

  it('reports cache miss when both poses contain NaN at the same field', () => {
    const a = { ...baselinePose(), qy: Number.NaN }
    const b = { ...baselinePose(), qy: Number.NaN }
    // Critical safety property: NaN-vs-NaN must NOT collapse to "same" — that
    // would cause the renderer to skip culling forever once a NaN slips in.
    expect(isCameraPoseSimilar(a, b)).toBe(false)
  })

  // -----------------------------------------------------------------------
  // Identity & symmetry — sanity checks
  // -----------------------------------------------------------------------
  it('is symmetric: similar(a, b) === similar(b, a)', () => {
    const a = baselinePose()
    const b = { ...a, x: a.x + POSE_POSITION_TOLERANCE * 0.5 }
    expect(isCameraPoseSimilar(a, b)).toBe(isCameraPoseSimilar(b, a))

    const c = { ...a, x: a.x + 1.0 }
    expect(isCameraPoseSimilar(a, c)).toBe(isCameraPoseSimilar(c, a))
  })

  it('is reflexive for finite-only poses (every-field-equal must hit cache)', () => {
    const a = baselinePose()
    expect(isCameraPoseSimilar(a, a)).toBe(true)
    expect(isCameraPoseSimilar(a, { ...a })).toBe(true)
  })

  // -----------------------------------------------------------------------
  // Custom tolerance overrides — for callers that want stricter/looser matching
  // -----------------------------------------------------------------------
  it('honors custom tolerance arguments', () => {
    const a = baselinePose()
    const b = { ...a, x: a.x + 0.5 }
    // 0.5 m delta — at default tolerance (1 mm), this is changed.
    expect(isCameraPoseSimilar(a, b)).toBe(false)
    // With a 1 m position tolerance, the same delta becomes a cache hit.
    expect(isCameraPoseSimilar(a, b, 1.0)).toBe(true)
  })
})
