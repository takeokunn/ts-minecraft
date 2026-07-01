import { describe, expect, it } from 'vitest'
import { hashString } from '@ts-minecraft/entity/domain/village/village-hash'

// ─── hashString ───────────────────────────────────────────────────────────────
describe('hashString', () => {
  it('returns a non-negative integer for any string', () => {
    expect(hashString('hello')).toBeGreaterThanOrEqual(0)
    expect(hashString('world')).toBeGreaterThanOrEqual(0)
  })

  it('returns 0 for an empty string', () => {
    expect(hashString('')).toBe(0)
  })

  it('is deterministic — same input always returns same output', () => {
    const a = hashString('village-1')
    const b = hashString('village-1')
    expect(a).toBe(b)
  })

  it('produces different values for different inputs (no trivial collision)', () => {
    expect(hashString('abc')).not.toBe(hashString('xyz'))
  })

  it('is sensitive to input order — anagrams produce different hashes', () => {
    expect(hashString('abc')).not.toBe(hashString('cba'))
  })

  it('handles long strings without negative overflow (Math.abs guard)', () => {
    const longString = 'x'.repeat(1000)
    expect(hashString(longString)).toBeGreaterThanOrEqual(0)
  })
})
