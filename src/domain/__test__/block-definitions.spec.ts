import { describe, it, assert } from '@effect/vitest'
import { Effect } from 'effect'
import { blockDefinitions } from '../block-definitions'
import { blockTypeNames } from '../block-types'

describe('blockDefinitions', () => {
  it('should be successfully decoded', () =>
    Effect.gen(function* (_) {
      const definitions = yield* _(blockDefinitions)
      assert.isDefined(definitions)
    }))

  it('should contain all block types', () =>
    Effect.gen(function* (_) {
      const definitions = yield* _(blockDefinitions)
      for (const name of blockTypeNames) {
        assert.isDefined(definitions[name])
      }
    }))
})
