import { describe, it, assert } from '@effect/vitest'
import { createQuery } from '../query'
import { Effect, Gen } from 'effect'
import * as fc from 'effect/FastCheck'
import { ComponentNameSchema } from '../components'

describe('Query', () => {
  describe('createQuery', () => {
    it.effect('should create a query object with the given components', () =>
      Gen.flatMap(fc.string(), (name) =>
        Gen.flatMap(fc.array(fc.gen(ComponentNameSchema)), (components) =>
          Effect.sync(() => {
            const query = createQuery(name, components)
            assert.strictEqual(query.name, name)
            assert.deepStrictEqual(query.components, components)
            assert.deepStrictEqual(query.set, new Set(components))
          }),
        ),
      ))
  })
})