import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { evaluateSpline } from '../domain/spline'
import type { Spline } from '../domain/spline'

// ---------------------------------------------------------------------------
// evaluateSpline — edge-case coverage
// ---------------------------------------------------------------------------

describe('evaluateSpline', () => {
  it('returns 0 for an empty spline', () => {
    expect(evaluateSpline([], 0.5)).toBe(0)
  })

  it('returns the only control point value for a single-point spline', () => {
    const spline: Spline = [[0.5, 42]]
    expect(evaluateSpline(spline, 0.0)).toBe(42)
    expect(evaluateSpline(spline, 0.5)).toBe(42)
    expect(evaluateSpline(spline, 1.0)).toBe(42)
  })

  it('clamps to first control point when t is below the spline range', () => {
    const spline: Spline = [[0.2, 10], [0.8, 90]]
    expect(evaluateSpline(spline, 0.0)).toBe(10)
    expect(evaluateSpline(spline, 0.1)).toBe(10)
  })

  it('clamps to last control point when t is above the spline range', () => {
    const spline: Spline = [[0.2, 10], [0.8, 90]]
    expect(evaluateSpline(spline, 0.9)).toBe(90)
    expect(evaluateSpline(spline, 1.0)).toBe(90)
  })

  it('linearly interpolates between two control points', () => {
    const spline: Spline = [[0, 0], [1, 100]]
    expect(evaluateSpline(spline, 0.5)).toBe(50)
    expect(evaluateSpline(spline, 0.25)).toBe(25)
  })

  it('evaluates the correct segment when multiple segments exist', () => {
    // Three segments: [0→0.5] and [0.5→1.0].
    const spline: Spline = [[0, 0], [0.5, 50], [1, 100]]
    expect(evaluateSpline(spline, 0.25)).toBe(25)  // first segment
    expect(evaluateSpline(spline, 0.75)).toBe(75)  // second segment
    expect(evaluateSpline(spline, 0.5)).toBe(50)   // exact knot
  })

  it('returns the first segment interpolation when two consecutive control points share the same t (duplicate t)', () => {
    // Spline with duplicate t=0.5 at indices 1 and 2.
    // When t=0.5 is evaluated, the loop matches index i=1 first ([0, 0]→[0.5, 3]),
    // which has span=0.5. The second [0.5, 7] entry is never reached.
    // span===0 guard (the defensive zero-width-segment path) is in the [i-1, i] pair
    // where both share the same t; to reach it the loop would need t > spline[i-1][0]
    // AND t <= spline[i][0] with both equal — a structural contradiction, so the
    // first matched segment always wins.
    const spline: Spline = [[0, 0], [0.5, 3], [0.5, 7], [1, 10]]
    // i=1 is matched: t0=0, t1=0.5, span=0.5 → interpolation gives 3.
    expect(evaluateSpline(spline, 0.5)).toBe(3)
  })
})
