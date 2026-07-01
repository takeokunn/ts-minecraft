import { describe, expect, it } from 'vitest'
import { createEntity, EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { zero, identity } from '@ts-minecraft/core'

// ─── createEntity ─────────────────────────────────────────────────────────────
describe('createEntity', () => {
  it('sets all required fields from params', () => {
    const entity = createEntity({
      entityId: EntityId.make('zombie-1'),
      position: { x: 10, y: 64, z: 20 },
      type: EntityType.Zombie,
      health: 20,
    })
    expect(entity.entityId).toBe('zombie-1')
    expect(entity.position).toEqual({ x: 10, y: 64, z: 20 })
    expect(entity.type).toBe(EntityType.Zombie)
    expect(entity.health).toBe(20)
  })

  it('defaults velocity to zero when not provided', () => {
    const entity = createEntity({
      entityId: EntityId.make('cow-1'),
      position: { x: 0, y: 64, z: 0 },
      type: EntityType.Cow,
      health: 10,
    })
    expect(entity.velocity).toEqual(zero)
  })

  it('defaults rotation to identity when not provided', () => {
    const entity = createEntity({
      entityId: EntityId.make('pig-1'),
      position: { x: 0, y: 64, z: 0 },
      type: EntityType.Pig,
      health: 10,
    })
    expect(entity.rotation).toEqual(identity)
  })

  it('uses provided velocity when specified', () => {
    const velocity = { x: 1, y: 0, z: -1 }
    const entity = createEntity({
      entityId: EntityId.make('skeleton-1'),
      position: { x: 0, y: 64, z: 0 },
      type: EntityType.Skeleton,
      health: 20,
      velocity,
    })
    expect(entity.velocity).toEqual(velocity)
  })

  it('uses provided rotation when specified', () => {
    const rotation = { x: 0, y: 0.707, z: 0, w: 0.707 }
    const entity = createEntity({
      entityId: EntityId.make('creeper-1'),
      position: { x: 0, y: 64, z: 0 },
      type: EntityType.Creeper,
      health: 20,
      rotation,
    })
    expect(entity.rotation).toEqual(rotation)
  })
})

// ─── EntityId ─────────────────────────────────────────────────────────────────
describe('EntityId', () => {
  it('creates a branded EntityId from a string', () => {
    const id = EntityId.make('entity-123')
    expect(String(id)).toBe('entity-123')
  })
})

// ─── EntityType ───────────────────────────────────────────────────────────────
describe('EntityType', () => {
  it('has correct string values for key entity types', () => {
    expect(EntityType.Zombie).toBe('Zombie')
    expect(EntityType.Creeper).toBe('Creeper')
    expect(EntityType.EnderDragon).toBe('EnderDragon')
  })
})
