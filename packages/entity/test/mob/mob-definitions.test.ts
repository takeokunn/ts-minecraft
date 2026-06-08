import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import { EntityType } from '../../domain/mob/entity'
import { getMobDefinition, MobDefinitions } from '../../domain/mob/mobs'
import { MobDefinitionSchema } from '../../domain/mob/mobs/mob-definition'
import { HOSTILE_MOBS, PASSIVE_MOBS } from '../../domain/mob/mob-categories'

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
      const zombieDef = getMobDefinition(EntityType.Zombie)
      expect(def.attackDamage).toBeGreaterThan(zombieDef.attackDamage)
    })

    it('drops GUNPOWDER', () => {
      expect(def.drops.some((d) => d.blockType === 'GUNPOWDER')).toBe(true)
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
      const zombieDef = getMobDefinition(EntityType.Zombie)
      expect(def.detectionRange).toBeGreaterThanOrEqual(zombieDef.detectionRange)
    })

    it('drops BONE', () => {
      expect(def.drops.some((d) => d.blockType === 'BONE')).toBe(true)
    })

    it('drops ARROW', () => {
      expect(def.drops.some((d) => d.blockType === 'ARROW')).toBe(true)
    })
  })

  describe('passive mobs correct drops', () => {
    it('pig drops COOKED_PORKCHOP', () => {
      const def = getMobDefinition(EntityType.Pig)
      expect(def.drops.some((d) => d.blockType === 'COOKED_PORKCHOP')).toBe(true)
    })

    it('sheep drops WOOL', () => {
      const def = getMobDefinition(EntityType.Sheep)
      expect(def.drops.some((d) => d.blockType === 'WOOL')).toBe(true)
    })

    it('cow drops RAW_BEEF', () => {
      const def = getMobDefinition(EntityType.Cow)
      expect(def.drops.some((d) => d.blockType === 'RAW_BEEF')).toBe(true)
    })

    it('cow drops LEATHER', () => {
      const def = getMobDefinition(EntityType.Cow)
      expect(def.drops.some((d) => d.blockType === 'LEATHER')).toBe(true)
    })
  })

  describe('Spider', () => {
    const def = getMobDefinition(EntityType.Spider)

    it('is hostile', () => {
      expect(def.behavior).toBe('hostile')
    })

    it('drops STRING', () => {
      expect(def.drops.some((d) => d.blockType === 'STRING')).toBe(true)
    })

    it('drops SPIDER_EYE', () => {
      expect(def.drops.some((d) => d.blockType === 'SPIDER_EYE')).toBe(true)
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
      const hostileHPs = [EntityType.Zombie, EntityType.Creeper, EntityType.Skeleton, EntityType.Spider]
        .map((t) => getMobDefinition(t).maxHealth)
      expect(def.maxHealth).toBeGreaterThan(Math.max(...hostileHPs))
    })

    it('drops ENDER_PEARL', () => {
      expect(def.drops.some((d) => d.blockType === 'ENDER_PEARL')).toBe(true)
    })

    it('has a longer attack range than melee mobs', () => {
      expect(def.attackRange).toBeGreaterThan(getMobDefinition(EntityType.Zombie).attackRange)
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
    it('HOSTILE_MOBS contains Zombie, Creeper, Skeleton, Spider, and Enderman', () => {
      expect(HOSTILE_MOBS).toContain(EntityType.Zombie)
      expect(HOSTILE_MOBS).toContain(EntityType.Creeper)
      expect(HOSTILE_MOBS).toContain(EntityType.Skeleton)
      expect(HOSTILE_MOBS).toContain(EntityType.Spider)
      expect(HOSTILE_MOBS).toContain(EntityType.Enderman)
    })

    it('PASSIVE_MOBS contains Cow, Pig, and Sheep', () => {
      expect(PASSIVE_MOBS).toContain(EntityType.Cow)
      expect(PASSIVE_MOBS).toContain(EntityType.Pig)
      expect(PASSIVE_MOBS).toContain(EntityType.Sheep)
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
