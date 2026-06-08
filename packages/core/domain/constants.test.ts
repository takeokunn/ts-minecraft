import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import { WorldIdSchema, PlayerIdSchema, DeltaTimeSecsSchema } from './kernel'
import {
  DEFAULT_WORLD_ID,
  DEFAULT_PLAYER_ID,
  FIRST_FRAME_DELTA_SECS,
  SEA_LEVEL,
  LAKE_LEVEL,
  PLAYER_HALF_WIDTH,
  PLAYER_HALF_HEIGHT,
} from './constants'

describe('DEFAULT_WORLD_ID', () => {
  it('is a valid WorldId', () => {
    expect(Schema.is(WorldIdSchema)(DEFAULT_WORLD_ID)).toBe(true)
  })

  it('has value "world-1"', () => {
    expect(DEFAULT_WORLD_ID).toBe('world-1')
  })
})

describe('DEFAULT_PLAYER_ID', () => {
  it('is a valid PlayerId', () => {
    expect(Schema.is(PlayerIdSchema)(DEFAULT_PLAYER_ID)).toBe(true)
  })

  it('has value "player-1"', () => {
    expect(DEFAULT_PLAYER_ID).toBe('player-1')
  })
})

describe('FIRST_FRAME_DELTA_SECS', () => {
  it('is a valid DeltaTimeSecs', () => {
    expect(Schema.is(DeltaTimeSecsSchema)(FIRST_FRAME_DELTA_SECS)).toBe(true)
  })

  it('is approximately 0.016 (16ms at 60fps)', () => {
    expect(FIRST_FRAME_DELTA_SECS).toBeCloseTo(0.016)
  })

  it('is positive', () => {
    expect(FIRST_FRAME_DELTA_SECS).toBeGreaterThan(0)
  })
})

describe('SEA_LEVEL / LAKE_LEVEL ordering', () => {
  it('SEA_LEVEL is a positive integer', () => {
    expect(SEA_LEVEL).toBeGreaterThan(0)
    expect(Number.isInteger(SEA_LEVEL)).toBe(true)
  })

  it('LAKE_LEVEL is a positive integer', () => {
    expect(LAKE_LEVEL).toBeGreaterThan(0)
    expect(Number.isInteger(LAKE_LEVEL)).toBe(true)
  })

  it('LAKE_LEVEL matches SEA_LEVEL for lake surface alignment', () => {
    expect(LAKE_LEVEL).toBe(SEA_LEVEL)
  })

  it('SEA_LEVEL is 63 (MC 1.18-aligned)', () => {
    expect(SEA_LEVEL).toBe(63)
  })

  it('LAKE_LEVEL is 63', () => {
    expect(LAKE_LEVEL).toBe(63)
  })
})

describe('PLAYER_HALF_WIDTH', () => {
  it('is a positive finite number', () => {
    expect(PLAYER_HALF_WIDTH).toBeGreaterThan(0)
    expect(Number.isFinite(PLAYER_HALF_WIDTH)).toBe(true)
  })

  it('equals 0.3 (x/z half-extent matching Minecraft player hitbox)', () => {
    expect(PLAYER_HALF_WIDTH).toBeCloseTo(0.3)
  })
})

describe('PLAYER_HALF_HEIGHT', () => {
  it('is a positive finite number', () => {
    expect(PLAYER_HALF_HEIGHT).toBeGreaterThan(0)
    expect(Number.isFinite(PLAYER_HALF_HEIGHT)).toBe(true)
  })

  it('equals 0.9 (y half-extent matching Minecraft player hitbox)', () => {
    expect(PLAYER_HALF_HEIGHT).toBeCloseTo(0.9)
  })

  it('PLAYER_HALF_HEIGHT is larger than PLAYER_HALF_WIDTH (player is taller than wide)', () => {
    expect(PLAYER_HALF_HEIGHT).toBeGreaterThan(PLAYER_HALF_WIDTH)
  })
})
