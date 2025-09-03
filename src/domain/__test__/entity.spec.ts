import { describe, it, assert } from '@effect/vitest'
import { Effect } from 'effect'
import { toEntityId, EntityId } from '../entity'

describe('EntityId', () => {
  it.effect('should create a branded EntityId from a number', () =>
    Effect.gen(function*(_) {
      const id = 1
      const entityId = yield* _(toEntityId(id))
      assert.strictEqual(entityId, id)
    }),
  )

  it.effect('should create different EntityIds for different numbers', () =>
    Effect.gen(function*(_) {
      const id1 = 1
      const id2 = 2
      const entityId1 = yield* _(toEntityId(id1))
      const entityId2 = yield* _(toEntityId(id2))
      assert.notStrictEqual(entityId1, entityId2)
    }),
  )

  it.effect('EntityId brand should not allow direct creation', () =>
    Effect.sync(() => {
      const id: number = 1
      // @ts-expect-error This should not compile
      const entityId: EntityId = id
      assert.strictEqual(typeof entityId, 'number')
    }))
})
