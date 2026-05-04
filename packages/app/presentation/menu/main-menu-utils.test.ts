import { describe, it, expect } from 'vitest'
import { formatLastPlayed, cycleGameMode, generateWorldId } from './main-menu-utils'

describe('formatLastPlayed', () => {
  it('formats a valid date as a locale string', () => {
    const date = new Date('2026-05-03T12:00:00.000Z')
    const result = formatLastPlayed(date)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('falls back to ISO string for invalid dates', () => {
    const date = new Date('invalid')
    const result = formatLastPlayed(date)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('falls back to ISO string when locale formatting throws', () => {
    class ThrowingLocaleDate extends Date {
      override toLocaleString(): string {
        throw new Error('locale unavailable')
      }
    }

    const date = new ThrowingLocaleDate('2026-05-03T12:00:00.000Z')
    expect(formatLastPlayed(date)).toBe(date.toISOString())
  })
})

describe('cycleGameMode', () => {
  it('cycles survival → creative', () => {
    expect(cycleGameMode('survival')).toBe('creative')
  })

  it('cycles creative → survival', () => {
    expect(cycleGameMode('creative')).toBe('survival')
  })

  it('is its own inverse', () => {
    expect(cycleGameMode(cycleGameMode('survival'))).toBe('survival')
    expect(cycleGameMode(cycleGameMode('creative'))).toBe('creative')
  })
})

describe('generateWorldId', () => {
  it('returns a WorldId starting with world-', () => {
    const id = generateWorldId()
    expect(String(id)).toMatch(/^world-\d+-\d+$/)
  })

  it('generates distinct IDs on consecutive calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => String(generateWorldId())))
    expect(ids.size).toBeGreaterThan(1)
  })
})
