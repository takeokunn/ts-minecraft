import { describe, it, expect } from 'vitest'
import { Array as Arr, Option } from 'effect'
import { evaluateSpline, type Spline } from './spline'

describe('domain/spline', () => {
  it('empty spline returns 0 for any input', () => {
    const s: Spline = []
    expect(evaluateSpline(s, -10)).toBe(0)
    expect(evaluateSpline(s, 0)).toBe(0)
    expect(evaluateSpline(s, 100)).toBe(0)
  })

  it('single point returns its value for any input', () => {
    const s: Spline = [[0.5, 42]]
    expect(evaluateSpline(s, -100)).toBe(42)
    expect(evaluateSpline(s, 0.5)).toBe(42)
    expect(evaluateSpline(s, 100)).toBe(42)
  })

  it('two points: exact interpolation at midpoint', () => {
    const s: Spline = [[0, 0], [1, 10]]
    expect(evaluateSpline(s, 0.5)).toBeCloseTo(5, 10)
  })

  it('two points: clamps below first t', () => {
    const s: Spline = [[0, 3], [1, 10]]
    expect(evaluateSpline(s, -1)).toBe(3)
    expect(evaluateSpline(s, -100)).toBe(3)
    expect(evaluateSpline(s, 0)).toBe(3)
  })

  it('two points: clamps above last t', () => {
    const s: Spline = [[0, 3], [1, 10]]
    expect(evaluateSpline(s, 1)).toBe(10)
    expect(evaluateSpline(s, 2)).toBe(10)
    expect(evaluateSpline(s, 1000)).toBe(10)
  })

  it('three points: exact at each control point', () => {
    const s: Spline = [[-1, 5], [0, 20], [1, 8]]
    expect(evaluateSpline(s, -1)).toBe(5)
    expect(evaluateSpline(s, 0)).toBe(20)
    expect(evaluateSpline(s, 1)).toBe(8)
  })

  it('three points: linear interpolation at quarter/three-quarter points in both segments', () => {
    const s: Spline = [[0, 0], [1, 10], [2, 30]]
    // First segment [0,1] -> value goes 0..10
    expect(evaluateSpline(s, 0.25)).toBeCloseTo(2.5, 10)
    expect(evaluateSpline(s, 0.75)).toBeCloseTo(7.5, 10)
    // Second segment [1,2] -> value goes 10..30
    expect(evaluateSpline(s, 1.25)).toBeCloseTo(15, 10)
    expect(evaluateSpline(s, 1.75)).toBeCloseTo(25, 10)
  })

  it('monotonic-decreasing spline: decreasing input gives decreasing output', () => {
    const s: Spline = [[-1, 100], [0, 50], [1, 10]]
    const samples = Arr.map([-1, -0.6, -0.2, 0.2, 0.6, 1] as const, (t) => evaluateSpline(s, t))
    // Each successive sample must be <= the previous one (non-increasing).
    Arr.reduce(Arr.drop(samples, 1), Option.getOrThrow(Arr.get(samples, 0)), (prev, cur) => {
      expect(cur).toBeLessThanOrEqual(prev)
      return cur
    })
    // And strictly decreasing across endpoints.
    expect(Option.getOrThrow(Arr.last(samples))).toBeLessThan(Option.getOrThrow(Arr.get(samples, 0)))
  })
})
