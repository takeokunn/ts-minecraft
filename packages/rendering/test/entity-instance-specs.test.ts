import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import type { EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import {
  getRoleSpec,
  ROLES_BY_TYPE,
  type PartRole,
} from '../infrastructure/entity/entity-instance-pool'

// Active renderable entity types are the keys of ROLES_BY_TYPE.
// Shulker remains data-only until a renderable entity path exists.
const ACTIVE_ENTITY_TYPES = Object.keys(ROLES_BY_TYPE) as ReadonlyArray<EntityType>
const ALL_PART_ROLES: ReadonlyArray<PartRole> = [
  'head', 'body', 'armL', 'armR', 'legFL', 'legFR', 'legBL', 'legBR',
]

describe('ROLES_BY_TYPE completeness', () => {
  it('has 18 active renderable entity types', () => {
    expect(ACTIVE_ENTITY_TYPES.length).toBe(18)
  })

  it('each entity has at least one role', () => {
    for (const type of ACTIVE_ENTITY_TYPES) {
      expect(ROLES_BY_TYPE[type].length, `${type} has no roles`).toBeGreaterThan(0)
    }
  })

  it('all listed roles are valid PartRole values', () => {
    for (const type of ACTIVE_ENTITY_TYPES) {
      for (const role of ROLES_BY_TYPE[type]) {
        expect(ALL_PART_ROLES).toContain(role)
      }
    }
  })
})

describe('getRoleSpec', () => {
  it('returns Option.some for each role listed in ROLES_BY_TYPE', () => {
    for (const type of ACTIVE_ENTITY_TYPES) {
      for (const role of ROLES_BY_TYPE[type]) {
        const spec = getRoleSpec(type, role)
        expect(Option.isSome(spec), `${type}.${role} should have a spec`).toBe(true)
      }
    }
  })

  it('returns Option.none for roles NOT listed in ROLES_BY_TYPE', () => {
    for (const type of ACTIVE_ENTITY_TYPES) {
      const listed = new Set(ROLES_BY_TYPE[type])
      for (const role of ALL_PART_ROLES) {
        if (!listed.has(role)) {
          const spec = getRoleSpec(type, role)
          expect(Option.isNone(spec), `${type}.${role} should have no spec`).toBe(true)
        }
      }
    }
  })

  it('Zombie has biped roles (arms but no back legs)', () => {
    expect(Option.isSome(getRoleSpec('Zombie', 'armL'))).toBe(true)
    expect(Option.isSome(getRoleSpec('Zombie', 'armR'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Zombie', 'legBL'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Zombie', 'legBR'))).toBe(true)
  })

  it('Cow has quadruped roles (back legs but no arms)', () => {
    expect(Option.isSome(getRoleSpec('Cow', 'legBL'))).toBe(true)
    expect(Option.isSome(getRoleSpec('Cow', 'legBR'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Cow', 'armL'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Cow', 'armR'))).toBe(true)
  })

  it('Endermite has compact quadruped roles for event-spawned mobs', () => {
    const body = Option.getOrThrow(getRoleSpec('Endermite', 'body'))
    const leg = Option.getOrThrow(getRoleSpec('Endermite', 'legFL'))
    expect(Option.isNone(getRoleSpec('Endermite', 'armL'))).toBe(true)
    expect(Option.isSome(getRoleSpec('Endermite', 'legBL'))).toBe(true)
    expect(body.size[1]).toBeLessThan(0.25)
    expect(leg.size[0]).toBeLessThan(0.1)
  })

  it('Chicken has wing arm roles and no back legs', () => {
    const wing = Option.getOrThrow(getRoleSpec('Chicken', 'armL'))
    const body = Option.getOrThrow(getRoleSpec('Chicken', 'body'))
    const leg = Option.getOrThrow(getRoleSpec('Chicken', 'legFL'))
    expect(Option.isSome(getRoleSpec('Chicken', 'armR'))).toBe(true)
    expect(Option.isSome(getRoleSpec('Chicken', 'legFR'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Chicken', 'legBL'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Chicken', 'legBR'))).toBe(true)
    expect(wing.size[1]).toBeLessThan(body.size[1])
    expect(wing.offset.x).toBeGreaterThan(body.offset.x)
    expect(leg.color).toBe(0xe0a020)
  })

  it('Bat has wing arm roles and no back legs', () => {
    const wing = Option.getOrThrow(getRoleSpec('Bat', 'armL'))
    const body = Option.getOrThrow(getRoleSpec('Bat', 'body'))
    expect(Option.isSome(getRoleSpec('Bat', 'armR'))).toBe(true)
    expect(Option.isSome(getRoleSpec('Bat', 'legFL'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Bat', 'legBL'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Bat', 'legBR'))).toBe(true)
    expect(wing.size[0]).toBeGreaterThan(body.size[0])
    expect(wing.size[1]).toBeLessThan(body.size[1])
  })

  it('Bee has wing arm roles and no back legs', () => {
    const wing = Option.getOrThrow(getRoleSpec('Bee', 'armL'))
    const body = Option.getOrThrow(getRoleSpec('Bee', 'body'))
    expect(Option.isSome(getRoleSpec('Bee', 'armR'))).toBe(true)
    expect(Option.isSome(getRoleSpec('Bee', 'legFL'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Bee', 'legBL'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Bee', 'legBR'))).toBe(true)
    expect(wing.size[0]).toBeGreaterThan(body.size[0])
    expect(wing.size[1]).toBeLessThan(body.size[1])
    expect(body.color).toBe(0xe4b83f)
    expect(wing.color).toBe(0xb9e6ff)
  })

  it('Squid has a vertical mantle above its head and four tentacle roles', () => {
    const body = Option.getOrThrow(getRoleSpec('Squid', 'body'))
    const head = Option.getOrThrow(getRoleSpec('Squid', 'head'))
    const tentacle = Option.getOrThrow(getRoleSpec('Squid', 'legFL'))
    expect(Option.isNone(getRoleSpec('Squid', 'armL'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Squid', 'armR'))).toBe(true)
    expect(Option.isSome(getRoleSpec('Squid', 'legBL'))).toBe(true)
    expect(Option.isSome(getRoleSpec('Squid', 'legBR'))).toBe(true)
    expect(body.offset.y).toBeGreaterThan(head.offset.y)
    expect(head.offset.y).toBeGreaterThan(tentacle.offset.y)
  })

  it('GlowSquid shares squid tentacle roles with a luminous cyan palette', () => {
    const body = Option.getOrThrow(getRoleSpec('GlowSquid', 'body'))
    const head = Option.getOrThrow(getRoleSpec('GlowSquid', 'head'))
    const tentacle = Option.getOrThrow(getRoleSpec('GlowSquid', 'legFL'))
    expect(Option.isNone(getRoleSpec('GlowSquid', 'armL'))).toBe(true)
    expect(Option.isNone(getRoleSpec('GlowSquid', 'armR'))).toBe(true)
    expect(Option.isSome(getRoleSpec('GlowSquid', 'legBL'))).toBe(true)
    expect(Option.isSome(getRoleSpec('GlowSquid', 'legBR'))).toBe(true)
    expect(body.offset.y).toBeGreaterThan(head.offset.y)
    expect(head.offset.y).toBeGreaterThan(tentacle.offset.y)
    expect(body.color).toBe(0x5df0df)
    expect(tentacle.color).toBe(0x1db8aa)
  })

  it('Witch keeps biped roles but uses a robe-sized body', () => {
    const body = Option.getOrThrow(getRoleSpec('Witch', 'body'))
    const head = Option.getOrThrow(getRoleSpec('Witch', 'head'))
    const arm = Option.getOrThrow(getRoleSpec('Witch', 'armL'))
    const leg = Option.getOrThrow(getRoleSpec('Witch', 'legFL'))
    expect(Option.isSome(getRoleSpec('Witch', 'armR'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Witch', 'legBL'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Witch', 'legBR'))).toBe(true)
    expect(head.size[0]).toBeLessThan(body.size[0])
    expect(body.size[1]).toBeGreaterThan(leg.size[1] * 2)
    expect(arm.size[1]).toBeGreaterThan(leg.size[1])
    expect(body.color).toBe(0x4b2a63)
  })

  it('Drowned keeps biped roles with a waterlogged palette', () => {
    const body = Option.getOrThrow(getRoleSpec('Drowned', 'body'))
    const head = Option.getOrThrow(getRoleSpec('Drowned', 'head'))
    const arm = Option.getOrThrow(getRoleSpec('Drowned', 'armL'))
    const leg = Option.getOrThrow(getRoleSpec('Drowned', 'legFL'))
    expect(Option.isSome(getRoleSpec('Drowned', 'armR'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Drowned', 'legBL'))).toBe(true)
    expect(Option.isNone(getRoleSpec('Drowned', 'legBR'))).toBe(true)
    expect(body.size[0]).toBeGreaterThan(leg.size[0])
    expect(arm.size[0]).toBeLessThan(leg.size[0])
    expect(arm.size[1]).toBeGreaterThan(body.size[1])
    expect(head.color).toBe(0x4fa89a)
    expect(body.color).toBe(0x1f5f72)
  })

  it('ZombieVillager keeps biped roles with a villager-like robe silhouette', () => {
    const body = Option.getOrThrow(getRoleSpec('ZombieVillager', 'body'))
    const head = Option.getOrThrow(getRoleSpec('ZombieVillager', 'head'))
    const arm = Option.getOrThrow(getRoleSpec('ZombieVillager', 'armL'))
    const leg = Option.getOrThrow(getRoleSpec('ZombieVillager', 'legFL'))
    expect(Option.isSome(getRoleSpec('ZombieVillager', 'armR'))).toBe(true)
    expect(Option.isNone(getRoleSpec('ZombieVillager', 'legBL'))).toBe(true)
    expect(Option.isNone(getRoleSpec('ZombieVillager', 'legBR'))).toBe(true)
    expect(head.size[0]).toBeGreaterThan(body.size[0])
    expect(body.size[0]).toBeGreaterThan(leg.size[0])
    expect(body.size[1]).toBeGreaterThan(leg.size[1])
    expect(arm.size[1]).toBeGreaterThan(leg.size[1])
    expect(head.color).toBe(0x7fa85a)
    expect(body.color).toBe(0x7a4f2a)
  })

  it('EnderDragon has only head and body', () => {
    expect(Option.isSome(getRoleSpec('EnderDragon', 'head'))).toBe(true)
    expect(Option.isSome(getRoleSpec('EnderDragon', 'body'))).toBe(true)
    expect(Option.isNone(getRoleSpec('EnderDragon', 'armL'))).toBe(true)
    expect(Option.isNone(getRoleSpec('EnderDragon', 'legFL'))).toBe(true)
  })
})

describe('RoleSpec structural validity', () => {
  it('all specs have 3-element size tuples with positive values', () => {
    for (const type of ACTIVE_ENTITY_TYPES) {
      for (const role of ROLES_BY_TYPE[type]) {
        const spec = Option.getOrThrow(getRoleSpec(type, role))
        expect(spec.size).toHaveLength(3)
        for (const dim of spec.size) {
          expect(dim, `${type}.${role} dimension should be positive`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('all specs have valid pivot values', () => {
    for (const type of ACTIVE_ENTITY_TYPES) {
      for (const role of ROLES_BY_TYPE[type]) {
        const spec = Option.getOrThrow(getRoleSpec(type, role))
        expect(['center', 'top']).toContain(spec.pivot)
      }
    }
  })

  it('all specs have numeric color values', () => {
    for (const type of ACTIVE_ENTITY_TYPES) {
      for (const role of ROLES_BY_TYPE[type]) {
        const spec = Option.getOrThrow(getRoleSpec(type, role))
        expect(typeof spec.color).toBe('number')
      }
    }
  })
})
