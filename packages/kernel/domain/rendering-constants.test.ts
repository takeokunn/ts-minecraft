import { describe, it, expect } from 'vitest'
import { MAX_SHADOW_HALF_EXTENT } from './rendering-constants'

describe('MAX_SHADOW_HALF_EXTENT', () => {
  it('equals 136', () => {
    expect(MAX_SHADOW_HALF_EXTENT).toBe(136)
  })
})
