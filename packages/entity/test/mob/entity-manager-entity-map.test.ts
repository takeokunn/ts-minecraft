import { describe, expect, it } from 'vitest'
import { HashMap, Option } from 'effect'
import { EntityId } from '@ts-minecraft/entity'
import { mapManagedEntities } from '../../application/mob/entity-manager-entity-map'
import { expectSome } from './test-utils'

describe('entity/entityManagerEntityMap', () => {
  it('returns the original map when nothing changes', () => {
    const entityId = EntityId.make('entity-map-unchanged')
    const entity = { health: 20, ageTicks: 0 }
    const entities = HashMap.set(HashMap.empty<EntityId, typeof entity>(), entityId, entity)

    const result = mapManagedEntities(entities, (current) => current)

    expect(result).toBe(entities)
  })

  it('preserves untouched entries while replacing changed ones', () => {
    const firstId = EntityId.make('entity-map-first')
    const secondId = EntityId.make('entity-map-second')
    const first = { health: 20, ageTicks: 0 }
    const second = { health: 18, ageTicks: 4 }
    const entities = HashMap.empty<EntityId, typeof first>()
    const withFirst = HashMap.set(entities, firstId, first)
    const withBoth = HashMap.set(withFirst, secondId, second)

    const result = mapManagedEntities(withBoth, (current, id) =>
      id === secondId ? { ...current, health: current.health - 1 } : current
    )

    expect(result).not.toBe(withBoth)
    expect(HashMap.get(result, firstId)).toEqual(Option.some(first))
    expect(HashMap.get(result, secondId)).toEqual(Option.some({ health: 17, ageTicks: 4 }))
    expect(expectSome(HashMap.get(result, firstId))).toBe(first)
    expect(expectSome(HashMap.get(result, secondId))).not.toBe(second)
  })
})
