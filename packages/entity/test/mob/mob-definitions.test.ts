import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import { EntityType } from '../../domain/mob/entity'
import { getMobDefinition } from '../../domain/mob/mobs/get-mob-definition'
import { MobDefinitions } from '../../domain/mob/mobs/mob-definitions'
import { MobDefinitionSchema } from '../../domain/mob/mobs/mob-definition'
import { HOSTILE_MOBS, PASSIVE_MOBS } from '../../domain/mob/mob-categories'

type MobDefinition = ReturnType<typeof getMobDefinition>
type DropBlockType = MobDefinition['drops'][number]['blockType']

const zombieDef = getMobDefinition(EntityType.Zombie)

const expectDrops = (definition: MobDefinition, ...blockTypes: ReadonlyArray<DropBlockType>) => {
  const dropTypes = definition.drops.map((drop) => drop.blockType)
  for (const blockType of blockTypes) {
    expect(dropTypes).toContain(blockType)
  }
}

const expectDrop = (definition: MobDefinition, drop: MobDefinition['drops'][number]) => {
  expect(definition.drops).toContainEqual(drop)
}

describe('mob definitions', () => {
  it('every EntityType has a definition in MobDefinitions', () => {
    const allTypes = Object.values(EntityType)
    for (const type of allTypes) {
      expect(() => getMobDefinition(type)).not.toThrow()
    }
  })

  describe('Creeper', () => {
    const def = getMobDefinition(EntityType.Creeper)

    it('is hostile', () => {
      expect(def.behavior).toBe('hostile')
    })

    it('has higher attack damage than Zombie (represents explosion)', () => {
      expect(def.attackDamage).toBeGreaterThan(zombieDef.attackDamage)
    })

    it('drops GUNPOWDER', () => {
      expectDrops(def, 'GUNPOWDER')
    })

    it('never flees (fleeHealthThreshold = 0)', () => {
      expect(def.fleeHealthThreshold).toBe(0)
    })
  })

  describe('Skeleton', () => {
    const def = getMobDefinition(EntityType.Skeleton)

    it('is hostile', () => {
      expect(def.behavior).toBe('hostile')
    })

    it('has a long detection range (ranged attacker)', () => {
      expect(def.detectionRange).toBeGreaterThanOrEqual(zombieDef.detectionRange)
    })

    it('drops BONE', () => {
      expectDrops(def, 'BONE')
    })

    it('drops ARROW', () => {
      expectDrops(def, 'ARROW')
    })

    it('can rarely drop its equipped bow', () => {
      expect(def.drops).toContainEqual({ blockType: 'BOW', count: 1, chance: 0.085 })
    })
  })

  describe('passive mobs correct drops', () => {
    it('pig drops RAW_PORKCHOP', () => {
      const def = getMobDefinition(EntityType.Pig)
      expectDrops(def, 'RAW_PORKCHOP')
    })

    it('sheep drops WOOL', () => {
      const def = getMobDefinition(EntityType.Sheep)
      expectDrops(def, 'WOOL')
    })

    it('sheep drops RAW_MUTTON', () => {
      const def = getMobDefinition(EntityType.Sheep)
      expectDrops(def, 'RAW_MUTTON')
    })

    it('cow drops RAW_BEEF', () => {
      const def = getMobDefinition(EntityType.Cow)
      expectDrops(def, 'RAW_BEEF')
    })

    it('cow drops LEATHER', () => {
      const def = getMobDefinition(EntityType.Cow)
      expectDrops(def, 'LEATHER')
    })

    it('chicken drops FEATHER', () => {
      const def = getMobDefinition(EntityType.Chicken)
      expectDrops(def, 'FEATHER')
    })

    it('chicken drops RAW_CHICKEN', () => {
      const def = getMobDefinition(EntityType.Chicken)
      expectDrops(def, 'RAW_CHICKEN')
    })

    it('bat drops nothing and grants no XP', () => {
      const def = getMobDefinition(EntityType.Bat)
      expect(def.drops).toHaveLength(0)
      expect(def.xpReward).toBe(0)
    })

    it('bee drops nothing and grants XP', () => {
      const def = getMobDefinition(EntityType.Bee)
      expect(def.behavior).toBe('passive')
      expect(def.drops).toHaveLength(0)
      expect(def.xpReward).toBe(1)
    })

    it('squid drops INK_SAC', () => {
      const def = getMobDefinition(EntityType.Squid)
      expectDrops(def, 'INK_SAC')
    })

    it('glow squid is passive and currently drops INK_SAC', () => {
      const def = getMobDefinition(EntityType.GlowSquid)
      expect(def.behavior).toBe('passive')
      expectDrops(def, 'INK_SAC')
    })
  })

  describe('Spider', () => {
    const def = getMobDefinition(EntityType.Spider)

    it('is hostile', () => {
      expect(def.behavior).toBe('hostile')
    })

    it('drops STRING', () => {
      expectDrops(def, 'STRING')
    })

    it('drops SPIDER_EYE', () => {
      expectDrops(def, 'SPIDER_EYE')
    })

    it('is faster than a zombie', () => {
      expect(def.speed).toBeGreaterThan(getMobDefinition(EntityType.Zombie).speed)
    })
  })

  describe('Enderman', () => {
    const def = getMobDefinition(EntityType.Enderman)

    it('is hostile', () => {
      expect(def.behavior).toBe('hostile')
    })

    it('has the highest HP of all hostile mobs', () => {
      const hostileHPs = [
        EntityType.Zombie,
        EntityType.Creeper,
        EntityType.Skeleton,
        EntityType.Spider,
        EntityType.Witch,
        EntityType.Drowned,
        EntityType.ZombieVillager,
      ].map((t) => getMobDefinition(t).maxHealth)
      expect(def.maxHealth).toBeGreaterThan(Math.max(...hostileHPs))
    })

    it('drops ENDER_PEARL', () => {
      expectDrops(def, 'ENDER_PEARL')
    })

    it('has a longer attack range than melee mobs', () => {
      expect(def.attackRange).toBeGreaterThan(getMobDefinition(EntityType.Zombie).attackRange)
    })
  })

  describe('Witch', () => {
    const def = getMobDefinition(EntityType.Witch)

    it('is hostile', () => {
      expect(def.behavior).toBe('hostile')
    })

    it('has more health than a zombie', () => {
      expect(def.maxHealth).toBeGreaterThan(getMobDefinition(EntityType.Zombie).maxHealth)
    })

    it('uses melee range until potion throwing is implemented', () => {
      expect(def.attackRange).toBe(getMobDefinition(EntityType.Zombie).attackRange)
    })

    it('drops existing potion ingredient items', () => {
      expectDrops(def, 'REDSTONE_DUST', 'GLOWSTONE_DUST', 'SPIDER_EYE', 'STICKS')
    })
  })

  describe('Zombie', () => {
    const def = getMobDefinition(EntityType.Zombie)

    it('drops vanilla-style zombie rare loot that exists in core', () => {
      expectDrop(def, { blockType: 'ROTTEN_FLESH', count: 1 })
      expectDrop(def, { blockType: 'CARROT', count: 1, chance: 0.025 })
      expectDrop(def, { blockType: 'IRON_INGOT', count: 1, chance: 0.025 })
    })
  })

  describe('Drowned', () => {
    const def = getMobDefinition(EntityType.Drowned)

    it('is hostile', () => {
      expect(def.behavior).toBe('hostile')
    })

    it('matches zombie health and melee range', () => {
      const zombieDef = getMobDefinition(EntityType.Zombie)
      expect(def.maxHealth).toBe(zombieDef.maxHealth)
      expect(def.attackDamage).toBe(zombieDef.attackDamage)
      expect(def.attackRange).toBe(zombieDef.attackRange)
    })

    it('drops existing drowned loot placeholders', () => {
      expectDrops(def, 'ROTTEN_FLESH', 'RAW_COD')
    })
  })

  describe('ZombieVillager', () => {
    const def = getMobDefinition(EntityType.ZombieVillager)

    it('is hostile', () => {
      expect(def.behavior).toBe('hostile')
    })

    it('matches zombie combat stats until villager conversion is implemented', () => {
      const zombieDef = getMobDefinition(EntityType.Zombie)
      expect(def.maxHealth).toBe(zombieDef.maxHealth)
      expect(def.attackDamage).toBe(zombieDef.attackDamage)
      expect(def.attackRange).toBe(zombieDef.attackRange)
    })

    it('drops vanilla-style zombie villager rare loot that exists in core', () => {
      expectDrop(def, { blockType: 'ROTTEN_FLESH', count: 1 })
      expectDrop(def, { blockType: 'CARROT', count: 1, chance: 0.025 })
      expectDrop(def, { blockType: 'IRON_INGOT', count: 1, chance: 0.025 })
    })
  })

  // The MobDefinitionSchema constraints (positive HP, non-negative ranges,
  // whole positive drop counts, flee threshold in [0,1]) are only meaningful if
  // the shipped definitions actually satisfy them. Decoding every definition
  // here turns the otherwise type-only schema into an enforced invariant, so a
    // future definition with e.g. negative health or a fractional drop count
    // fails this test instead of silently shipping.
    describe('schema validation', () => {
      const decode = Schema.decodeUnknownSync(MobDefinitionSchema)

    for (const [type, definition] of Object.entries(MobDefinitions)) {
      it(`${type} definition satisfies MobDefinitionSchema`, () => {
        expect(() => decode(definition)).not.toThrow()
      })
    }

    it('admits a passive mob with attackRange 0 (regression: was rejected by positive())', () => {
      expect(() => decode(getMobDefinition(EntityType.Pig))).not.toThrow()
      expect(getMobDefinition(EntityType.Pig).attackRange).toBe(0)
    })
  })

  describe('mob categories', () => {
    it('HOSTILE_MOBS contains Zombie, Creeper, Skeleton, Spider, Enderman, Witch, Drowned, and ZombieVillager', () => {
      expect(HOSTILE_MOBS).toContain(EntityType.Zombie)
      expect(HOSTILE_MOBS).toContain(EntityType.Creeper)
      expect(HOSTILE_MOBS).toContain(EntityType.Skeleton)
      expect(HOSTILE_MOBS).toContain(EntityType.Spider)
      expect(HOSTILE_MOBS).toContain(EntityType.Enderman)
      expect(HOSTILE_MOBS).toContain(EntityType.Witch)
      expect(HOSTILE_MOBS).toContain(EntityType.Drowned)
      expect(HOSTILE_MOBS).toContain(EntityType.ZombieVillager)
    })

    it('PASSIVE_MOBS contains Cow, Pig, Sheep, Chicken, Bat, Bee, Squid, and GlowSquid', () => {
      expect(PASSIVE_MOBS).toContain(EntityType.Cow)
      expect(PASSIVE_MOBS).toContain(EntityType.Pig)
      expect(PASSIVE_MOBS).toContain(EntityType.Sheep)
      expect(PASSIVE_MOBS).toContain(EntityType.Chicken)
      expect(PASSIVE_MOBS).toContain(EntityType.Bat)
      expect(PASSIVE_MOBS).toContain(EntityType.Bee)
      expect(PASSIVE_MOBS).toContain(EntityType.Squid)
      expect(PASSIVE_MOBS).toContain(EntityType.GlowSquid)
    })

    it('no mob appears in both hostile and passive categories', () => {
      const hostileSet = new Set(HOSTILE_MOBS)
      const overlap = PASSIVE_MOBS.filter((m) => hostileSet.has(m))
      expect(overlap).toHaveLength(0)
    })

    it('every hostile mob has behavior=hostile in its definition', () => {
      for (const type of HOSTILE_MOBS) {
        expect(getMobDefinition(type).behavior).toBe('hostile')
      }
    })

    it('every passive mob has behavior=passive in its definition', () => {
      for (const type of PASSIVE_MOBS) {
        expect(getMobDefinition(type).behavior).toBe('passive')
      }
    })
  })

  describe('speed guard — stationary mobs', () => {
    // Stationary mobs are legitimately speed=0 (e.g. Shulkers don't walk).
    // The schema uses nonNegative() to permit this, but non-stationary
    // mobs MUST have positive speed. This test enforces that invariant.
    const STATIONARY_MOBS: ReadonlyArray<EntityType> = [EntityType.Shulker]

    it('Shulker (stationary) has speed=0', () => {
      expect(getMobDefinition(EntityType.Shulker).speed).toBe(0)
    })

    it('all non-stationary mobs have positive speed', () => {
      const stationarySet = new Set(STATIONARY_MOBS)
      for (const type of Object.values(EntityType)) {
        if (stationarySet.has(type)) continue
        const def = getMobDefinition(type)
        expect(
          def.speed,
          `${type} is not marked stationary — expected positive speed, got ${def.speed}`,
        ).toBeGreaterThan(0)
      }
    })
  })
})
