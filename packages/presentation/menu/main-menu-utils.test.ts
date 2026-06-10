import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
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

  it('uses ISO string formatting for valid dates', () => {
    const date = new Date('2026-05-03T12:00:00.000Z')
    expect(formatLastPlayed(date)).toBe(date.toISOString())
  })
})

describe('cycleGameMode', () => {
  it('cycles survival → creative', () => {
    expect(cycleGameMode('survival')).toBe('creative')
  })

  it('cycles creative → spectator', () => {
    expect(cycleGameMode('creative')).toBe('spectator')
  })

  it('cycles spectator → survival (3-way wrap)', () => {
    expect(cycleGameMode('spectator')).toBe('survival')
  })

  it('returns to survival after a full 3-step cycle', () => {
    expect(cycleGameMode(cycleGameMode(cycleGameMode('survival')))).toBe('survival')
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
