import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { MobDefinitions, getMobDefinition } from '../domain/mobs'
import { EntityType } from '../domain/entity'

const allEntityTypes = Object.values(EntityType) as EntityType[]

describe('MobDefinitions — data integrity', () => {
  it('has an entry for every EntityType', () => {
    Arr.forEach(allEntityTypes, (type) => {
      expect(MobDefinitions[type]).toBeDefined()
    })
  })

  it('every mob maxHealth is positive', () => {
    Arr.forEach(allEntityTypes, (type) => {
      expect(MobDefinitions[type].maxHealth).toBeGreaterThan(0)
    })
  })

  it('every mob speed is positive', () => {
    Arr.forEach(allEntityTypes, (type) => {
      expect(MobDefinitions[type].speed).toBeGreaterThan(0)
    })
  })

  it('every mob detectionRange is positive', () => {
    Arr.forEach(allEntityTypes, (type) => {
      expect(MobDefinitions[type].detectionRange).toBeGreaterThan(0)
    })
  })

  it('every mob fleeHealthThreshold is in [0, 1]', () => {
    Arr.forEach(allEntityTypes, (type) => {
      const threshold = MobDefinitions[type].fleeHealthThreshold
      expect(threshold).toBeGreaterThanOrEqual(0)
      expect(threshold).toBeLessThanOrEqual(1)
    })
  })

  it('every mob attackDamage is non-negative', () => {
    Arr.forEach(allEntityTypes, (type) => {
      expect(MobDefinitions[type].attackDamage).toBeGreaterThanOrEqual(0)
    })
  })

  it('passive mobs have attackDamage = 0', () => {
    Arr.forEach(allEntityTypes, (type) => {
      const def = MobDefinitions[type]
      if (def.behavior === 'passive') {
        expect(def.attackDamage).toBe(0)
      }
    })
  })

  it('hostile mobs have attackDamage > 0', () => {
    Arr.forEach(allEntityTypes, (type) => {
      const def = MobDefinitions[type]
      if (def.behavior === 'hostile') {
        expect(def.attackDamage).toBeGreaterThan(0)
      }
    })
  })

  it('every mob type field matches its EntityType key', () => {
    Arr.forEach(allEntityTypes, (type) => {
      expect(MobDefinitions[type].type).toBe(type)
    })
  })

  it('every mob behavior is hostile or passive', () => {
    Arr.forEach(allEntityTypes, (type) => {
      const behavior = MobDefinitions[type].behavior
      expect(['hostile', 'passive']).toContain(behavior)
    })
  })

  it('every mob drops array is defined', () => {
    Arr.forEach(allEntityTypes, (type) => {
      expect(Array.isArray(MobDefinitions[type].drops)).toBe(true)
    })
  })
})

describe('getMobDefinition', () => {
  it('returns the correct definition for each EntityType', () => {
    Arr.forEach(allEntityTypes, (type) => {
      const def = getMobDefinition(type)
      expect(def.type).toBe(type)
    })
  })

  it('returns the same reference as MobDefinitions lookup', () => {
    Arr.forEach(allEntityTypes, (type) => {
      expect(getMobDefinition(type)).toBe(MobDefinitions[type])
    })
  })

  it('Zombie is hostile', () => {
    expect(getMobDefinition(EntityType.Zombie).behavior).toBe('hostile')
  })

  it('Cow is passive', () => {
    expect(getMobDefinition(EntityType.Cow).behavior).toBe('passive')
  })

  it('Pig is passive', () => {
    expect(getMobDefinition(EntityType.Pig).behavior).toBe('passive')
  })

  it('Sheep is passive', () => {
    expect(getMobDefinition(EntityType.Sheep).behavior).toBe('passive')
  })
})
