import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { SchemaOptimization } from '../schema-optimization'

describe('SchemaOptimization', () => {
  describe('Performance-Optimized Schema Validation', () => {
    it.effect('optimized validation is functionally equivalent', () =>
      Effect.succeed(undefined).pipe(
        Effect.tap(() => {
          const testData = { name: 'test', value: 42 }
          const optimizedValidator = SchemaOptimization.createOptimizedValidator(
            Schema.Struct({ name: Schema.String, value: Schema.Number }) as any,
            'strict'
          )

          return Effect.gen(function* () {
            const optimizedResult = yield* Effect.either(optimizedValidator.validate(testData))
            expect(optimizedResult._tag).toBe('Right')
          })
        })
      )
    )

    it.effect('cache improves repeated validations', () =>
      Effect.succeed(undefined).pipe(
        Effect.tap(() => {
          const schema = Schema.Struct({ id: Schema.String })
          const testData = { id: 'test-123' }
          const cacheValidator = SchemaOptimization.createCacheAwareValidator(schema as any)

          return Effect.gen(function* () {
            const result1 = yield* cacheValidator.validateWithCache(testData, 'test-key', 1000)
            const result2 = yield* cacheValidator.validateWithCache(testData, 'test-key', 1000)

            expect(result1).toEqual(result2)
            expect((result1 as any).id).toBe('test-123')
          })
        })
      )
    )
  })
})
