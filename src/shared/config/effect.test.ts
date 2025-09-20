import { describe, it, expect } from 'vitest'
import { Effect, Exit, pipe } from 'effect'
import * as EffectConfig from './effect'

describe('Effect Configuration', () => {
  describe('Basic Effect utilities', () => {
    it('should create and run simple effects', () => {
      const effect = EffectConfig.succeed(42)
      const result = EffectConfig.runSync(effect)
      expect(result).toBe(42)
    })

    it('should handle failures with fail', () => {
      const effect = EffectConfig.fail(new Error('test error'))
      expect(() => EffectConfig.runSync(effect)).toThrow('test error')
    })

    it('should handle sync operations', () => {
      const effect = EffectConfig.sync(() => 'hello world')
      const result = EffectConfig.runSync(effect)
      expect(result).toBe('hello world')
    })

    it('should compose effects with pipe', () => {
      const effect = pipe(
        EffectConfig.succeed(5),
        EffectConfig.map((n) => n * 2),
        EffectConfig.flatMap((n) => EffectConfig.succeed(n + 3))
      )
      const result = EffectConfig.runSync(effect)
      expect(result).toBe(13)
    })
  })

  describe('Error handling', () => {
    it('should catch errors with catchAll', () => {
      const effect = pipe(
        EffectConfig.fail('error'),
        EffectConfig.catchAll(() => EffectConfig.succeed('recovered'))
      )
      const result = EffectConfig.runSync(effect)
      expect(result).toBe('recovered')
    })

    it('should map errors', () => {
      const effect = pipe(
        EffectConfig.fail('original'),
        EffectConfig.mapError((e) => `mapped: ${e}`)
      )
      expect(() => EffectConfig.runSync(effect)).toThrow('mapped: original')
    })

    it('should handle orElse', () => {
      const effect = pipe(
        EffectConfig.fail('first'),
        EffectConfig.orElse(EffectConfig.succeed('fallback'))
      )
      const result = EffectConfig.runSync(effect)
      expect(result).toBe('fallback')
    })
  })

  describe('Async operations', () => {
    it('should handle promises', async () => {
      const effect = EffectConfig.promise(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'async result'
      })
      const result = await EffectConfig.runPromise(effect)
      expect(result).toBe('async result')
    })

    it('should handle tryPromise', async () => {
      const effect = EffectConfig.tryPromise({
        try: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return 'success'
        },
        catch: (error) => new Error(String(error))
      })
      const result = await EffectConfig.runPromise(effect)
      expect(result).toBe('success')
    })
  })

  describe('Schema validation', () => {
    it('should validate data with schemas', () => {
      const schema = EffectConfig.Schema.Struct({
        name: EffectConfig.Schema.String,
        age: EffectConfig.Schema.Number
      })

      const valid = { name: 'John', age: 30 }
      const effect = EffectConfig.validate(schema)(valid)
      const result = EffectConfig.runSync(effect)
      expect(result).toEqual(valid)
    })

    it('should fail validation for invalid data', () => {
      const schema = EffectConfig.Schema.Struct({
        name: EffectConfig.Schema.String,
        age: EffectConfig.Schema.Number
      })

      const invalid = { name: 'John', age: 'thirty' } as any
      const effect = EffectConfig.validate(schema)(invalid)
      expect(() => EffectConfig.runSync(effect)).toThrow()
    })
  })

  describe('Batch processing', () => {
    it('should process items in batch', async () => {
      const items = [1, 2, 3, 4, 5]
      const effect = EffectConfig.batch(
        items,
        (n) => EffectConfig.succeed(n * 2),
        { concurrency: 2 }
      )
      const result = await EffectConfig.runPromise(effect)
      expect(result).toEqual([2, 4, 6, 8, 10])
    })
  })

  describe('Logging utilities', () => {
    it('should log messages', () => {
      const effect = pipe(
        EffectConfig.logInfo('info message'),
        Effect.flatMap(() => EffectConfig.logDebug('debug message')),
        Effect.flatMap(() => EffectConfig.logError('error message'))
      )
      // ログ出力のテストは副作用のため、エラーが発生しないことを確認
      expect(() => EffectConfig.runSync(effect)).not.toThrow()
    })
  })

  describe('Performance measurement', () => {
    it('should measure execution time', async () => {
      const effect = EffectConfig.timed(
        'test-operation',
        EffectConfig.promise(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return 'done'
        })
      )
      const result = await EffectConfig.runPromise(effect)
      expect(result).toBe('done')
    })
  })

  describe('Service creation', () => {
    it('should create services with makeService', () => {
      interface TestService {
        getValue: () => string
      }

      const TestService = EffectConfig.makeService<TestService>('TestService')

      expect(TestService).toBeDefined()
      expect(TestService.key).toBe('@app/TestService')
    })
  })

  describe('Layer utilities', () => {
    it('should create layers', () => {
      interface Config {
        apiUrl: string
      }

      const ConfigTag = EffectConfig.Context.GenericTag<Config>('Config')

      const configLayer = EffectConfig.layerFrom(ConfigTag, {
        apiUrl: 'http://localhost:3000'
      })

      expect(configLayer).toBeDefined()
    })
  })

  describe('Retry mechanism', () => {
    it('should retry failed effects', async () => {
      let attempts = 0
      const effect = EffectConfig.withRetry(
        Effect.sync(() => {
          attempts++
          if (attempts < 3) {
            throw new Error('not yet')
          }
          return 'success'
        }),
        { times: 5, delay: 10 }
      )

      const result = await EffectConfig.runPromise(effect)
      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })
  })
})