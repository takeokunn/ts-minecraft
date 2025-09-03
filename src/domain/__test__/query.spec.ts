import { describe, it, assert } from '@effect/vitest'
import { createQuery } from '../query'
import { Effect } from 'effect'
import * as S from 'effect/Schema'
import * as Arbitrary from 'effect/Arbitrary'
import * as fc from 'effect/FastCheck'
import { ComponentNameSchema } from '../components'

describe('Query', () => {
  describe('createQuery', () => {
    it.effect('should create a query object with the given components', () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(
            fc.string(),
            Arbitrary.make(S.Array(ComponentNameSchema)),
            async (name, components) => {
              const query = createQuery(name, components)
              assert.strictEqual(query.name, name)
              assert.deepStrictEqual(query.components, components)
              assert.deepStrictEqual(query.set, new Set(components))
            },
          ),
        ),
      ),
    )
  })
})
