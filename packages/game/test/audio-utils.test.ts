import { describe, it, expect } from 'vitest'
import { clamp01, clampPan } from '../domain/audio-utils'

describe('clamp01', () => {
  it('returns value within [0, 1] unchanged', () => {
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(0)).toBe(0)
    expect(clamp01(1)).toBe(1)
  })
  it('clamps below 0 to 0', () => {
    expect(clamp01(-0.1)).toBe(0)
    expect(clamp01(-100)).toBe(0)
  })
  it('clamps above 1 to 1', () => {
    expect(clamp01(1.1)).toBe(1)
    expect(clamp01(100)).toBe(1)
  })
})

describe('clampPan', () => {
  it('returns value within [-1, 1] unchanged', () => {
    expect(clampPan(0)).toBe(0)
    expect(clampPan(-1)).toBe(-1)
    expect(clampPan(1)).toBe(1)
    expect(clampPan(0.5)).toBe(0.5)
  })
  it('clamps below -1 to -1', () => {
    expect(clampPan(-2)).toBe(-1)
    expect(clampPan(-100)).toBe(-1)
  })
  it('clamps above 1 to 1', () => {
    expect(clampPan(2)).toBe(1)
    expect(clampPan(100)).toBe(1)
  })
})
