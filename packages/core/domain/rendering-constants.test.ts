import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { MAX_SHADOW_HALF_EXTENT } from './rendering-constants'

const SHADOW_CAMERA_FAR_PLANE = 272

describe('MAX_SHADOW_HALF_EXTENT', () => {
  it('equals 136', () => {
    expect(MAX_SHADOW_HALF_EXTENT).toBe(136)
  })

  it('equals half the shadow camera far plane (272 / 2 = 136)', () => {
    expect(MAX_SHADOW_HALF_EXTENT).toBe(SHADOW_CAMERA_FAR_PLANE / 2)
  })

  it('is a positive integer', () => {
    expect(MAX_SHADOW_HALF_EXTENT).toBeGreaterThan(0)
    expect(Number.isInteger(MAX_SHADOW_HALF_EXTENT)).toBe(true)
  })
})
