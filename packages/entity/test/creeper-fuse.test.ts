import { describe, expect, it } from 'vitest'
import {
  CREEPER_FUSE_SECONDS,
  CREEPER_IGNITION_RANGE,
  initialCreeperFuse,
  tickCreeperFuse,
} from '@ts-minecraft/entity/domain/mob/creeper-fuse'

const at = (x: number, y = 0, z = 0) => ({ x, y, z })

// ─── tickCreeperFuse ──────────────────────────────────────────────────────────
describe('tickCreeperFuse', () => {
  it('does not ignite when the player is out of range', () => {
    const creeper = at(0)
    const player = at(CREEPER_IGNITION_RANGE + 0.1)
    const result = tickCreeperFuse(creeper, player, initialCreeperFuse, 0.016)
    expect(result.state.ignited).toBe(false)
    expect(result.detonate).toBe(false)
  })

  it('ignites when the player is within range', () => {
    const creeper = at(0)
    const player = at(CREEPER_IGNITION_RANGE - 0.1)
    const result = tickCreeperFuse(creeper, player, initialCreeperFuse, 0.016)
    expect(result.state.ignited).toBe(true)
    expect(result.detonate).toBe(false)
  })

  it('ignites when the player is exactly at the boundary (≤ check)', () => {
    const creeper = at(0)
    const player = at(CREEPER_IGNITION_RANGE)
    const result = tickCreeperFuse(creeper, player, initialCreeperFuse, 0.016)
    expect(result.state.ignited).toBe(true)
  })

  it('accumulates fuse time across multiple ticks', () => {
    const creeper = at(0)
    const player = at(1)
    let state = initialCreeperFuse
    for (let i = 0; i < 10; i++) {
      const step = tickCreeperFuse(creeper, player, state, 0.016)
      state = step.state
    }
    expect(state.fuseSecs).toBeCloseTo(0.16)
    expect(state.ignited).toBe(true)
  })

  it('detonates when fuse reaches CREEPER_FUSE_SECONDS in a single step', () => {
    const creeper = at(0)
    const player = at(1)
    const almostDone = { fuseSecs: CREEPER_FUSE_SECONDS - 0.01, ignited: true }
    const result = tickCreeperFuse(creeper, player, almostDone, 0.02)
    expect(result.detonate).toBe(true)
  })

  it('resets the fuse to zero when the player escapes mid-burn', () => {
    const creeper = at(0)
    const player = at(CREEPER_IGNITION_RANGE + 1)
    const halfBurned = { fuseSecs: 0.8, ignited: true }
    const result = tickCreeperFuse(creeper, player, halfBurned, 0.016)
    expect(result.state).toEqual(initialCreeperFuse)
    expect(result.detonate).toBe(false)
  })

  it('uses 3D distance — Y offset also counts toward range', () => {
    const creeper = at(0, 0, 0)
    // Player is at distance sqrt(0 + 9 + 0) = 3 which equals CREEPER_IGNITION_RANGE
    const player = at(0, CREEPER_IGNITION_RANGE, 0)
    const result = tickCreeperFuse(creeper, player, initialCreeperFuse, 0.016)
    expect(result.state.ignited).toBe(true)
  })
})

// ─── initialCreeperFuse ───────────────────────────────────────────────────────
describe('initialCreeperFuse', () => {
  it('starts with zero fuse and not ignited', () => {
    expect(initialCreeperFuse.fuseSecs).toBe(0)
    expect(initialCreeperFuse.ignited).toBe(false)
  })
})
