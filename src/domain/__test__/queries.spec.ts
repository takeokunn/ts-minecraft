import { describe, it, assert } from '@effect/vitest'
import * as Q from '../queries'
import { Effect } from 'effect'

describe('queries', () => {
  for (const [name, query] of Object.entries(Q)) {
    it.effect(`${name} should be a valid query object`, () =>
      Effect.sync(() => {
        assert.isDefined(query)
        assert.property(query, 'name')
        assert.property(query, 'components')
        assert.property(query, 'set')
      }),
    )
  }
})
