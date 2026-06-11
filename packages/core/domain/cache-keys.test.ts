import { describe, it, expect } from 'vitest'
import { ChunkCacheKey, TextureUrl, MaterialCacheKey } from './cache-keys'

describe('ChunkCacheKey', () => {
  it('formats coordinates as "x,z"', () => {
    expect(ChunkCacheKey.make({ x: 3, z: -5 })).toBe('3,-5')
  })

  it('handles zero coordinates', () => {
    expect(ChunkCacheKey.make({ x: 0, z: 0 })).toBe('0,0')
  })

  it('accepts a pre-formatted string directly', () => {
    expect(ChunkCacheKey.make('7,12')).toBe('7,12')
  })

  it('negative x and positive z', () => {
    expect(ChunkCacheKey.make({ x: -16, z: 32 })).toBe('-16,32')
  })
})

describe('TextureUrl', () => {
  it('returns the same string value', () => {
    expect(TextureUrl.make('/textures/atlas.png')).toBe('/textures/atlas.png')
  })

  it('handles empty string', () => {
    expect(TextureUrl.make('')).toBe('')
  })
})

describe('MaterialCacheKey', () => {
  it('formats a string color as "material-string-<value>"', () => {
    expect(MaterialCacheKey.make('#ff0000')).toBe('material-string-#ff0000')
  })

  it('formats a number as "material-number-<value>"', () => {
    expect(MaterialCacheKey.make(16711680)).toBe('material-number-16711680')
  })

  it('different values produce different keys', () => {
    expect(MaterialCacheKey.make(1)).not.toBe(MaterialCacheKey.make(2))
  })
})
