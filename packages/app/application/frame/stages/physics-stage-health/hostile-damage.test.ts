import { describe, expect, it } from 'vitest'
import { resolveHostileDamage, resolveHostileDeathCause, scaleHostileDamage } from './hostile-damage'

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

    expect(resolved.totalDamage).toBe(14)
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

    expect(resolved.totalDamage).toBe(14)
    expect(resolved.hostileDamage).toBe(14)
  })
})

describe('scaleHostileDamage', () => {
  it('multiplies all three channels by the difficulty multiplier', () => {
    const result = scaleHostileDamage({ contactDamage: 4, rangedDamage: 2, explosionDamage: 6 }, 1.5)
    expect(result.contactDamage).toBe(6)
    expect(result.rangedDamage).toBe(3)
    expect(result.explosionDamage).toBe(9)
  })

  it('returns zero for all channels when multiplier is 0 (peaceful)', () => {
    const result = scaleHostileDamage({ contactDamage: 5, rangedDamage: 3, explosionDamage: 2 }, 0)
    expect(result.contactDamage).toBe(0)
    expect(result.rangedDamage).toBe(0)
    expect(result.explosionDamage).toBe(0)
  })

  it('preserves values unchanged with multiplier 1', () => {
    const input = { contactDamage: 3, rangedDamage: 7, explosionDamage: 1 }
    expect(scaleHostileDamage(input, 1)).toEqual(input)
  })

  it('does not mutate the input object', () => {
    const input = { contactDamage: 4, rangedDamage: 2, explosionDamage: 6 }
    scaleHostileDamage(input, 2)
    expect(input).toEqual({ contactDamage: 4, rangedDamage: 2, explosionDamage: 6 })
  })
})

describe('resolveHostileDamage armor and protection', () => {
  it('armor points reduce damage below unarmored value', () => {
    const raw = { contactDamage: 10, rangedDamage: 0, explosionDamage: 0 }
    const noArmor = resolveHostileDamage(raw, 0, 0, 0, 0, false)
    const withArmor = resolveHostileDamage(raw, 20, 0, 0, 0, false)
    expect(withArmor.hostileDamage).toBeLessThan(noArmor.hostileDamage)
  })

  it('protection reduction further reduces hostileDamage beyond armor alone', () => {
    const raw = { contactDamage: 10, rangedDamage: 0, explosionDamage: 0 }
    const noProtection = resolveHostileDamage(raw, 4, 0, 0, 0, false)
    const withProtection = resolveHostileDamage(raw, 4, 0.25, 0, 0, false)
    expect(withProtection.hostileDamage).toBeLessThan(noProtection.hostileDamage)
  })

  it('projectile protection reduces ranged damage but not contact damage', () => {
    const rangedOnly = { contactDamage: 0, rangedDamage: 10, explosionDamage: 0 }
    const noProj = resolveHostileDamage(rangedOnly, 0, 0, 0, 0, false)
    const withProj = resolveHostileDamage(rangedOnly, 0, 0, 0.5, 0, false)
    expect(withProj.hostileDamage).toBeLessThan(noProj.hostileDamage)

    const contactOnly = { contactDamage: 10, rangedDamage: 0, explosionDamage: 0 }
    const contactNoProj = resolveHostileDamage(contactOnly, 0, 0, 0, 0, false)
    const contactWithProj = resolveHostileDamage(contactOnly, 0, 0, 0.5, 0, false)
    expect(contactWithProj.hostileDamage).toBe(contactNoProj.hostileDamage)
  })

  it('blast protection reduces explosion damage but not contact damage', () => {
    const explosionOnly = { contactDamage: 0, rangedDamage: 0, explosionDamage: 10 }
    const noBlast = resolveHostileDamage(explosionOnly, 0, 0, 0, 0, false)
    const withBlast = resolveHostileDamage(explosionOnly, 0, 0, 0, 0.5, false)
    expect(withBlast.hostileDamage).toBeLessThan(noBlast.hostileDamage)
  })

  it('totalDamage is unaffected by armor or protection reductions', () => {
    const raw = { contactDamage: 6, rangedDamage: 4, explosionDamage: 0 }
    const noArmor = resolveHostileDamage(raw, 0, 0, 0, 0, false)
    const fullArmor = resolveHostileDamage(raw, 20, 0.8, 0, 0, false)
    expect(noArmor.totalDamage).toBe(10)
    expect(fullArmor.totalDamage).toBe(10)
  })
})

describe('resolveHostileDeathCause', () => {
  it('returns explosion when explosionDamage > 0', () => {
    expect(resolveHostileDeathCause({ contactDamage: 0, rangedDamage: 0, explosionDamage: 5 })).toBe('explosion')
  })

  it('returns projectile when rangedDamage > 0 and explosionDamage = 0', () => {
    expect(resolveHostileDeathCause({ contactDamage: 0, rangedDamage: 3, explosionDamage: 0 })).toBe('projectile')
  })

  it('returns mob when only contactDamage > 0', () => {
    expect(resolveHostileDeathCause({ contactDamage: 4, rangedDamage: 0, explosionDamage: 0 })).toBe('mob')
  })

  it('returns generic when all damage values are zero', () => {
    expect(resolveHostileDeathCause({ contactDamage: 0, rangedDamage: 0, explosionDamage: 0 })).toBe('generic')
  })
})
