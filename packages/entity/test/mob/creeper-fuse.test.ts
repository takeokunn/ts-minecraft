import { describe, it, expect } from 'vitest'
import {
  CREEPER_IGNITION_RANGE,
  CREEPER_FUSE_SECONDS,
  initialCreeperFuse,
  tickCreeperFuse,
} from '@ts-minecraft/entity'

const creeper = { x: 0, y: 0, z: 0 }

describe('creeper fuse constants', () => {
  it('match vanilla detonation timing', () => {
    expect(CREEPER_IGNITION_RANGE).toBe(3)
    expect(CREEPER_FUSE_SECONDS).toBe(1.5)
    expect(initialCreeperFuse).toEqual({ fuseSecs: 0, ignited: false })
  })
})

describe('tickCreeperFuse', () => {
  it('resets the fuse when the player is out of ignition range', () => {
    const player = { x: 5, y: 0, z: 0 } // distance 5 > 3
    const step = tickCreeperFuse(creeper, player, { fuseSecs: 0.5, ignited: true }, 0.05)
    expect(step.detonate).toBe(false)
    expect(step.state).toEqual(initialCreeperFuse)
  })

  it('ignites and accumulates the fuse while the player is in range', () => {
    const player = { x: 2, y: 0, z: 0 } // distance 2 <= 3
    const step = tickCreeperFuse(creeper, player, initialCreeperFuse, 0.05)
    expect(step.detonate).toBe(false)
    expect(step.state.ignited).toBe(true)
    expect(step.state.fuseSecs).toBeCloseTo(0.05)
  })

  it('detonates on the step the fuse reaches the threshold', () => {
    const player = { x: 2, y: 0, z: 0 }
    const step = tickCreeperFuse(creeper, player, { fuseSecs: 1.49, ignited: true }, 0.05)
    expect(step.detonate).toBe(true)
    expect(step.state.fuseSecs).toBeGreaterThanOrEqual(CREEPER_FUSE_SECONDS)
  })

  it('cancels an in-progress fuse if the player escapes before it completes', () => {
    const player = { x: 10, y: 0, z: 0 } // out of range mid-fuse
    const step = tickCreeperFuse(creeper, player, { fuseSecs: 1.0, ignited: true }, 0.05)
    expect(step.detonate).toBe(false)
    expect(step.state).toEqual(initialCreeperFuse)
  })

  it('treats the exact ignition range boundary as in-range', () => {
    const player = { x: CREEPER_IGNITION_RANGE, y: 0, z: 0 } // distance exactly 3
    const step = tickCreeperFuse(creeper, player, initialCreeperFuse, 0.05)
    expect(step.state.ignited).toBe(true)
  })
})
