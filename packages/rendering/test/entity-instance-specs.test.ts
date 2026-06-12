import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import type { EntityType } from '@ts-minecraft/entity'
import {
  getRoleSpec,
  ROLES_BY_TYPE,
  type PartRole,
} from '../infrastructure/entity/entity-instance-pool'

// Active renderable entity types are the keys of ROLES_BY_TYPE
// (Shulker/Endermite are in EntityType but not renderable via instance pool)
const ACTIVE_ENTITY_TYPES = Object.keys(ROLES_BY_TYPE) as ReadonlyArray<EntityType>
const ALL_PART_ROLES: ReadonlyArray<PartRole> = [
  'head', 'body', 'armL', 'armR', 'legFL', 'legFR', 'legBL', 'legBR',
]

describe('ROLES_BY_TYPE completeness', () => {
  it('has 9 active renderable entity types', () => {
    expect(ACTIVE_ENTITY_TYPES.length).toBe(9)
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
