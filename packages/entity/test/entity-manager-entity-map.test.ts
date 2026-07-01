import { describe, expect, it } from 'vitest'
import { HashMap } from 'effect'
import { mapManagedEntities } from '@ts-minecraft/entity/application/mob/entity-manager-entity-map'
import { EntityId } from '@ts-minecraft/entity/domain/mob/entity'

// ─── mapManagedEntities ───────────────────────────────────────────────────────

type SimpleEntity = { id: string; value: number }

const id1 = EntityId.make('e-1')
const id2 = EntityId.make('e-2')
const e1: SimpleEntity = { id: 'e-1', value: 10 }
const e2: SimpleEntity = { id: 'e-2', value: 20 }

const makeMap = (): HashMap.HashMap<typeof id1, SimpleEntity> =>
  HashMap.set(HashMap.set(HashMap.empty(), id1, e1), id2, e2)

describe('mapManagedEntities', () => {
  it('returns the same reference when no entity changes', () => {
    const map = makeMap()
    const result = mapManagedEntities(map, (e) => e) // identity → no change
    expect(result).toBe(map)
  })

  it('updates only the entities that change', () => {
    const map = makeMap()
    const result = mapManagedEntities(map, (e) =>
      e.id === 'e-1' ? { ...e, value: 99 } : e,
    )
    expect(HashMap.get(result, id1)).toEqual({ value: { id: 'e-1', value: 99 } })
    expect(HashMap.get(result, id2)).toEqual({ value: e2 }) // unchanged ref-equality not guaranteed but value same
  })

  it('updates all entities when all change', () => {
    const map = makeMap()
    const result = mapManagedEntities(map, (e) => ({ ...e, value: e.value + 1 }))
    const r1 = HashMap.unsafeGet(result, id1)
    const r2 = HashMap.unsafeGet(result, id2)
    expect(r1.value).toBe(11)
    expect(r2.value).toBe(21)
  })

  it('returns an empty map unchanged when input is empty', () => {
    const empty = HashMap.empty<typeof id1, SimpleEntity>()
    const result = mapManagedEntities(empty, (e) => e)
    expect(HashMap.size(result)).toBe(0)
    expect(result).toBe(empty)
  })

  it('callback receives the entity id as second argument', () => {
    const seen: string[] = []
    const map = makeMap()
    mapManagedEntities(map, (e, id) => { seen.push(String(id)); return e })
    expect(seen.sort()).toEqual(['e-1', 'e-2'])
  })
})
