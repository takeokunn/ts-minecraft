import { describe, expect, it } from 'vitest'
import { resolveMinecartMultiplier } from '@ts-minecraft/game/application/game-state-update-orchestration'

describe('resolveMinecartMultiplier', () => {
  it('boosts to 2.5x on a redstone-powered powered rail', () => {
    expect(resolveMinecartMultiplier(true, true)).toBe(2.5)
  })

  it('brakes to 0.5x on an UNPOWERED powered rail (vanilla parity)', () => {
    expect(resolveMinecartMultiplier(true, false)).toBe(0.5)
  })

  it('plain rails ride at the base 1.85x regardless of the boost flag', () => {
    expect(resolveMinecartMultiplier(false, false)).toBe(1.85)
    expect(resolveMinecartMultiplier(false, true)).toBe(1.85)
  })
})
