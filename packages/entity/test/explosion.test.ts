import { describe, it, expect } from 'vitest'
import { CHARGED_CREEPER_EXPLOSION_POWER, CREEPER_EXPLOSION_POWER, TNT_EXPLOSION_POWER } from '@ts-minecraft/entity/domain/explosion';
import { computeExplosionDamage, computeExplosionDamageAt, explosionRadius } from '@ts-minecraft/entity/domain/explosion-resolution';

describe('explosion power constants', () => {
  it('match vanilla blast powers', () => {
    expect(CREEPER_EXPLOSION_POWER).toBe(3)
    expect(CHARGED_CREEPER_EXPLOSION_POWER).toBe(6)
    expect(TNT_EXPLOSION_POWER).toBe(4)
  })
})

describe('explosionRadius', () => {
  it('is 2 × power', () => {
    expect(explosionRadius(3)).toBe(6)
    expect(explosionRadius(4)).toBe(8)
  })
})

describe('computeExplosionDamage', () => {
  it('deals heavy damage at point-blank range (full exposure)', () => {
    // impact = 1 → ⌊(1+1)/2 · 7 · 6 + 1⌋ = ⌊43⌋
    expect(computeExplosionDamage(CREEPER_EXPLOSION_POWER, 0, 1)).toBe(43)
  })

  it('falls off with distance', () => {
    // d=3 of radius 6 → impact 0.5 → ⌊0.375 · 42 + 1⌋ = ⌊16.75⌋
    expect(computeExplosionDamage(CREEPER_EXPLOSION_POWER, 3, 1)).toBe(16)
  })

  it('deals minimal damage at the very edge of the blast radius', () => {
    // d=6 of radius 6 → impact 0 → ⌊1⌋
    expect(computeExplosionDamage(CREEPER_EXPLOSION_POWER, 6, 1)).toBe(1)
  })

  it('deals no damage beyond the blast radius', () => {
    expect(computeExplosionDamage(CREEPER_EXPLOSION_POWER, 7, 1)).toBe(0)
  })

  it('scales damage down with reduced exposure (cover)', () => {
    // exposure 0.5 at d=0 → impact 0.5 → same as full-exposure at half radius
    expect(computeExplosionDamage(CREEPER_EXPLOSION_POWER, 0, 0.5)).toBe(16)
  })
})

describe('computeExplosionDamageAt', () => {
  it('computes damage from 3D positions with full exposure by default', () => {
    const center = { x: 0, y: 0, z: 0 }
    const target = { x: 3, y: 0, z: 0 }
    expect(computeExplosionDamageAt(center, CREEPER_EXPLOSION_POWER, target)).toBe(16)
  })

  it('honours an explicit exposure argument', () => {
    const center = { x: 0, y: 0, z: 0 }
    const target = { x: 0, y: 0, z: 0 }
    expect(computeExplosionDamageAt(center, CREEPER_EXPLOSION_POWER, target, 0.5)).toBe(16)
  })

  it('returns 0 for a target outside the blast radius', () => {
    const center = { x: 0, y: 0, z: 0 }
    const target = { x: 0, y: 10, z: 0 }
    expect(computeExplosionDamageAt(center, CREEPER_EXPLOSION_POWER, target)).toBe(0)
  })
})
