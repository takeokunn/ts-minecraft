import { describe, expect } from 'vitest'
import { test } from '@fast-check/vitest'
import * as fc from 'fast-check'
import { clampPitch } from '../camera-logic'

const PI_HALF = Math.PI / 2

describe('clampPitch', () => {
  test.prop([fc.float()])('should always return a value between -PI/2 and PI/2', (pitch) => {
    const clamped = clampPitch(pitch)
    expect(clamped).toBeGreaterThanOrEqual(-PI_HALF)
    expect(clamped).toBeLessThanOrEqual(PI_HALF)
  })

  test('should return 0 for NaN input', () => {
    expect(clampPitch(NaN)).toBe(0)
  })

  test('should not change values within the valid range', () => {
    expect(clampPitch(0)).toBe(0)
    expect(clampPitch(PI_HALF / 2)).toBe(PI_HALF / 2)
    expect(clampPitch(-PI_HALF / 2)).toBe(-PI_HALF / 2)
  })

  test('should clamp values outside the valid range', () => {
    expect(clampPitch(Math.PI)).toBe(PI_HALF)
    expect(clampPitch(-Math.PI)).toBe(-PI_HALF)
  })
})
