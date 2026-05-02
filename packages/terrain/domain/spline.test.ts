import { describe, it, expect } from 'vitest'
import { evaluateSpline } from './spline'
import type { Spline } from './spline'

describe('evaluateSpline', () => {
  it('empty spline returns 0', () => {
    expect(evaluateSpline([], 0.5)).toBe(0)
  })

  it('single control point: any t returns that point value', () => {
    const spline: Spline = [[5, 42]]
    expect(evaluateSpline(spline, -10)).toBe(42)
    expect(evaluateSpline(spline, 5)).toBe(42)
    expect(evaluateSpline(spline, 100)).toBe(42)
  })

  it('t below minimum: returns first control point value (clamped)', () => {
    const spline: Spline = [[2, 10], [5, 20]]
    expect(evaluateSpline(spline, 0)).toBe(10)
    expect(evaluateSpline(spline, 2)).toBe(10)
  })

  it('t above maximum: returns last control point value (clamped)', () => {
    const spline: Spline = [[2, 10], [5, 20]]
    expect(evaluateSpline(spline, 6)).toBe(20)
    expect(evaluateSpline(spline, 5)).toBe(20)
  })

  it('exact t match: returns that control point value', () => {
    const spline: Spline = [[0, 0], [1, 100], [2, 200]]
    expect(evaluateSpline(spline, 1)).toBe(100)
  })

  it('linear interpolation between two points: t=0.5 returns midpoint', () => {
    const spline: Spline = [[0, 0], [1, 100]]
    expect(evaluateSpline(spline, 0.5)).toBeCloseTo(50, 3)
  })

  it('zero-width segment (duplicate t): returns v1 without NaN', () => {
    const spline: Spline = [[0, 0], [1, 50], [1, 99], [2, 100]]
    const result = evaluateSpline(spline, 1)
    expect(Number.isNaN(result)).toBe(false)
    expect(result).toBe(50)
  })

  it('multi-point spline: correct bracket selection (middle, not last)', () => {
    const spline: Spline = [[0, 0], [1, 10], [2, 30], [3, 60]]
    expect(evaluateSpline(spline, 1.5)).toBeCloseTo(20, 3)
    expect(evaluateSpline(spline, 2.5)).toBeCloseTo(45, 3)
  })
})
