import { HashMap, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import type { Position } from '@ts-minecraft/core'
import { EntityType, type EntityId } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { createSpawnedManagedEntity } from '../../application/mob/entity-manager-spawn'
import { damageManagedEntity } from '../../application/mob/entity-manager-damage'
import { expectSome } from './test-utils'

const position: Position = { x: 12, y: 64, z: -8 }

const makeEntity = (entityId: EntityId, type: EntityType, health: number): ManagedEntity => ({
  ...createSpawnedManagedEntity(entityId, type, position),
  health,
})

describe('entity-manager-damage', () => {
  it('returns drops and removes a lethally damaged entity', () => {
    const entityId = 'zombie-1' as EntityId
    const entity = makeEntity(entityId, EntityType.Zombie, 4)
    const entities = HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), entityId, entity)

    const [dropsOpt, updatedEntities] = damageManagedEntity(entities, entityId, 4)

    expect(Option.getOrNull(dropsOpt)).toEqual(entity.drops)
    expect(Option.isNone(HashMap.get(updatedEntities, entityId))).toBe(true)
  })

  it('reduces health for surviving damage without changing position', () => {
    const entityId = 'zombie-2' as EntityId
    const entity = makeEntity(entityId, EntityType.Zombie, 10)
    const entities = HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), entityId, entity)

    const [dropsOpt, updatedEntities] = damageManagedEntity(entities, entityId, 3)
    const updatedEntity = Option.getOrNull(HashMap.get(updatedEntities, entityId))

    expect(Option.isNone(dropsOpt)).toBe(true)
    expect(updatedEntity).not.toBeNull()
    expect(updatedEntity?.health).toBe(7)
    expect(updatedEntity?.position).toEqual(position)
  })

  it('ignores non-positive or missing damage targets', () => {
    const entityId = 'zombie-3' as EntityId
    const entity = makeEntity(entityId, EntityType.Zombie, 10)
    const entities = HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), entityId, entity)

    const [zeroDropsOpt, zeroEntities] = damageManagedEntity(entities, entityId, 0)
    const [missingDropsOpt, missingEntities] = damageManagedEntity(entities, 'missing' as EntityId, 3)

    expect(Option.isNone(zeroDropsOpt)).toBe(true)
    expectSome(HashMap.get(zeroEntities, entityId))
    expect(Option.isNone(missingDropsOpt)).toBe(true)
    expectSome(HashMap.get(missingEntities, entityId))
  })
})
