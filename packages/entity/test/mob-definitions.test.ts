import { describe, expect, it } from 'vitest'
import { MobDefinitions } from '@ts-minecraft/entity/domain/mob/mobs/mob-definitions'
import { EntityType } from '@ts-minecraft/entity/domain/mob/entity'

// ─── MobDefinitions completeness ─────────────────────────────────────────────

describe('MobDefinitions', () => {
  const allEntityTypes = Object.values(EntityType) as EntityType[]

  it('has an entry for every EntityType value', () => {
    for (const type of allEntityTypes) {
      expect(MobDefinitions[type], `Missing definition for ${type}`).toBeDefined()
    }
  })

  it('all definitions have a positive maxHealth', () => {
    for (const [type, def] of Object.entries(MobDefinitions)) {
      expect(def.maxHealth, `${type} maxHealth must be > 0`).toBeGreaterThan(0)
    }
  })

  it('all definitions have a non-negative attackDamage', () => {
    for (const [type, def] of Object.entries(MobDefinitions)) {
      expect(def.attackDamage, `${type} attackDamage must be >= 0`).toBeGreaterThanOrEqual(0)
    }
  })

  it('passive mobs have 0 attackDamage', () => {
    const passiveMobs = [EntityType.Cow, EntityType.Pig, EntityType.Sheep, EntityType.Chicken, EntityType.Bat]
    for (const type of passiveMobs) {
      expect(MobDefinitions[type].attackDamage).toBe(0)
    }
  })

  it('hostile mobs have positive attackDamage', () => {
    const hostileMobs = [EntityType.Zombie, EntityType.Skeleton, EntityType.Creeper, EntityType.Spider]
    for (const type of hostileMobs) {
      expect(MobDefinitions[type].attackDamage).toBeGreaterThan(0)
    }
  })

  it('EnderDragon has the highest maxHealth', () => {
    const dragonHealth = MobDefinitions[EntityType.EnderDragon].maxHealth
    for (const def of Object.values(MobDefinitions)) {
      if (def === MobDefinitions[EntityType.EnderDragon]) continue
      expect(dragonHealth).toBeGreaterThanOrEqual(def.maxHealth)
    }
  })
})
