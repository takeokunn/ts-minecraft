import { describe, it, assert } from '@effect/vitest'
import { createQuery } from '../query'
import { Effect } from 'effect'

describe('createQuery', () => {
  it.effect('should create a query object with the given components', () =>
    Effect.sync(() => {
      const query = createQuery('test', ['position', 'velocity'])
      assert.strictEqual(query.name, 'test')
      assert.deepStrictEqual(query.components, ['position', 'velocity'])
      assert.deepStrictEqual(query.set, new Set(['position', 'velocity']))
    }),
  )

  it.effect('should handle an empty component list', () =>
    Effect.sync(() => {
      const query = createQuery('test', [])
      assert.strictEqual(query.name, 'test')
      assert.deepStrictEqual(query.components, [])
      assert.deepStrictEqual(query.set, new Set())
    }),
  )
})
