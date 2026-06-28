import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'

import { hashWorldSeedString, parseWorldSeedInput } from '../domain/world-seed'

describe('world/domain/world-seed', () => {
  it('treats blank seed input as unset', () => {
    expect(parseWorldSeedInput('')).toBeUndefined()
    expect(parseWorldSeedInput('   ')).toBeUndefined()
  })

  it('parses safe signed integers as uint32 seeds', () => {
    expect(parseWorldSeedInput('0')).toBe(0)
    expect(parseWorldSeedInput('1234')).toBe(1234)
    expect(parseWorldSeedInput('-1')).toBe(0xffffffff)
  })

  it('hashes text inputs into deterministic uint32 seeds', () => {
    const seed = parseWorldSeedInput('village spawn')

    expect(seed).toBe(hashWorldSeedString('village spawn'))
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThanOrEqual(0xffffffff)
  })

  it('hashes unsafe integer strings instead of losing precision', () => {
    const unsafe = '9007199254740993'

    expect(parseWorldSeedInput(unsafe)).toBe(hashWorldSeedString(unsafe))
  })
})
