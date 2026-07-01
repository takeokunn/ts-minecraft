import { describe, expect, it } from 'vitest'
import { HOSTILE_MOBS, PASSIVE_MOBS } from '@ts-minecraft/entity/domain/mob/mob-categories'
import { EntityType } from '@ts-minecraft/entity/domain/mob/entity'

// ─── PASSIVE_MOBS ─────────────────────────────────────────────────────────────
describe('PASSIVE_MOBS', () => {
  it('contains at least one entry', () => {
    expect(PASSIVE_MOBS.length).toBeGreaterThan(0)
  })

  it('includes Cow, Pig, Sheep, Chicken (farm animals)', () => {
    expect(PASSIVE_MOBS).toContain(EntityType.Cow)
    expect(PASSIVE_MOBS).toContain(EntityType.Pig)
    expect(PASSIVE_MOBS).toContain(EntityType.Sheep)
    expect(PASSIVE_MOBS).toContain(EntityType.Chicken)
  })

  it('does not contain hostile mob types', () => {
    for (const hostile of HOSTILE_MOBS) {
      expect(PASSIVE_MOBS).not.toContain(hostile)
    }
  })

  it('has no duplicates', () => {
    const unique = new Set(PASSIVE_MOBS)
    expect(unique.size).toBe(PASSIVE_MOBS.length)
  })
})

// ─── HOSTILE_MOBS ─────────────────────────────────────────────────────────────
describe('HOSTILE_MOBS', () => {
  it('contains at least one entry', () => {
    expect(HOSTILE_MOBS.length).toBeGreaterThan(0)
  })

  it('includes Zombie, Creeper, Skeleton (classic hostiles)', () => {
    expect(HOSTILE_MOBS).toContain(EntityType.Zombie)
    expect(HOSTILE_MOBS).toContain(EntityType.Creeper)
    expect(HOSTILE_MOBS).toContain(EntityType.Skeleton)
  })

  it('does not contain passive mob types', () => {
    for (const passive of PASSIVE_MOBS) {
      expect(HOSTILE_MOBS).not.toContain(passive)
    }
  })

  it('has no duplicates', () => {
    const unique = new Set(HOSTILE_MOBS)
    expect(unique.size).toBe(HOSTILE_MOBS.length)
  })
})
