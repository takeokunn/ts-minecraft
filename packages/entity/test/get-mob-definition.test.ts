import { describe, expect, it } from 'vitest'
import { getMobDefinition } from '@ts-minecraft/entity/domain/mob/mobs/get-mob-definition'
import { EntityType } from '@ts-minecraft/entity/domain/mob/entity'

// ─── getMobDefinition ─────────────────────────────────────────────────────────
describe('getMobDefinition', () => {
  it('returns a definition with the matching type for Zombie', () => {
    const def = getMobDefinition(EntityType.Zombie)
    expect(def.type).toBe(EntityType.Zombie)
  })

  it('returns a definition with positive maxHealth', () => {
    const def = getMobDefinition(EntityType.Zombie)
    expect(def.maxHealth).toBeGreaterThan(0)
  })

  it('returns a definition with non-negative attackDamage', () => {
    const def = getMobDefinition(EntityType.Zombie)
    expect(def.attackDamage).toBeGreaterThanOrEqual(0)
  })

  it('returns the Creeper definition with correct type', () => {
    const def = getMobDefinition(EntityType.Creeper)
    expect(def.type).toBe(EntityType.Creeper)
  })

  it('returns a unique definition for each entity type', () => {
    const zombie = getMobDefinition(EntityType.Zombie)
    const skeleton = getMobDefinition(EntityType.Skeleton)
    expect(zombie.type).not.toBe(skeleton.type)
  })

  it('returns the Bat definition (passive mob has 0 attack damage)', () => {
    const def = getMobDefinition(EntityType.Bat)
    expect(def.attackDamage).toBe(0)
  })

  it('returns the EnderDragon with significantly high health', () => {
    const def = getMobDefinition(EntityType.EnderDragon)
    expect(def.maxHealth).toBeGreaterThan(100)
  })
})
