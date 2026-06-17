import { describe, expect, it } from 'vitest'
import { resolveHostileDamage } from './hostile-damage'

describe('physics-stage — hostile damage', () => {
  it('reduces blocking damage while preserving the raw scaled total', () => {
    const resolved = resolveHostileDamage(
      { contactDamage: 8, rangedDamage: 4, explosionDamage: 2 },
      0,
      0,
      0,
      0,
      true,
    )

    expect(resolved.scaledHostileDamage).toBe(14)
    expect(resolved.hostileDamage).toBeCloseTo(4.76)
  })

  it('leaves damage unchanged when the player is not blocking', () => {
    const resolved = resolveHostileDamage(
      { contactDamage: 8, rangedDamage: 4, explosionDamage: 2 },
      0,
      0,
      0,
      0,
      false,
    )

    expect(resolved.scaledHostileDamage).toBe(14)
    expect(resolved.hostileDamage).toBe(14)
  })
})
