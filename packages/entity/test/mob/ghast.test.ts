import { describe, expect, it } from 'vitest'
import { HashMap } from 'effect'
import { EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { ALL_HOSTILE_MOBS, NETHER_HOSTILE_MOBS } from '@ts-minecraft/entity/domain/mob/mob-categories'
import { GhastDefinition } from '@ts-minecraft/entity/domain/mob/mobs/ghast'
import { getMobDefinition } from '@ts-minecraft/entity/domain/mob/mobs/get-mob-definition'
import { resolvePlayerRangedDamage } from '@ts-minecraft/entity/application/mob/entity-manager-combat'
import type { EntityId } from '@ts-minecraft/entity/domain/mob/entity'

const makeGhast = (overrides: Record<string, unknown> = {}) => ({
  entityId: 'ghast-1' as EntityId,
  type: EntityType.Ghast,
  behavior: 'hostile' as const,
  position: { x: 5, y: 70, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  health: 10,
  maxHealth: 10,
  attackDamage: 4,
  speed: 0.7,
  detectionRange: 24,
  attackRange: 16,
  fleeHealthThreshold: 0,
  attackCooldownRemaining: 0,
  knockbackTicksRemaining: 0,
  ageTicks: 10_000,
  stuckTicks: 0,
  ...overrides,
})

describe('Ghast', () => {
  it('is registered as a nether hostile and counted by the hostile cap', () => {
    expect(NETHER_HOSTILE_MOBS).toContain(EntityType.Ghast)
    expect(ALL_HOSTILE_MOBS).toContain(EntityType.Ghast)
  })

  it('definition: ranged nether artillery with gunpowder drops', () => {
    const def = getMobDefinition(EntityType.Ghast)
    expect(def).toEqual(GhastDefinition)
    expect(def.behavior).toBe('hostile')
    expect(def.attackRange).toBeGreaterThanOrEqual(16)
    expect(def.drops).toEqual([{ blockType: 'GUNPOWDER', count: 1 }])
  })

  it('fireballs ride the ranged-damage path and ignite the player like a Blaze', () => {
    const entities = HashMap.make(['ghast-1' as EntityId, makeGhast() as never])
    const [resolution] = resolvePlayerRangedDamage(entities, { x: 0, y: 70, z: 0 })
    expect(resolution.damage).toBe(4)
    expect(resolution.igniteSecs).toBeGreaterThan(0)
  })

  it('does not fire while the shot is blocked by terrain', () => {
    const entities = HashMap.make(['ghast-1' as EntityId, makeGhast() as never])
    const [resolution] = resolvePlayerRangedDamage(entities, { x: 0, y: 70, z: 0 }, () => true)
    expect(resolution.damage).toBe(0)
  })
})
