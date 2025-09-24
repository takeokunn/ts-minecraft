import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Either, pipe } from 'effect'
import { Schema } from '@effect/schema'
import {
  GameErrorSchema,
  createGameError,
  EffectConfig,
  runSync,
  runPromise,
  sync,
  map,
  flatMap,
  catchAll,
  mapError,
  orElse,
  promise,
  tryPromise,
  batch,
  logInfo,
  logDebug,
  logError,
  timed,
  makeService,
  Context,
  layerFrom,
  withRetry,
} from '../effect'
import {
  BrandedTypes,
  PlayerIdSchema,
  WorldCoordinateSchema,
  ChunkIdSchema,
  BlockTypeIdSchema,
} from '../../types/branded'

describe('Effect-TS Configuration', () => {
  describe('GameError', () => {
    it.effect('should create a GameError with required fields', () =>
      Effect.gen(function* () {
        const error = createGameError('Test error', 'TEST_ERROR')

        expect(error.message).toBe('Test error')
        expect(error.code).toBe('TEST_ERROR')
        expect(error.timestamp).toBeInstanceOf(Date)
        expect(error._tag).toBe('GameError')
      })
    )

    it.effect('should validate GameError schema', () =>
      Effect.gen(function* () {
        const error = createGameError('Test error', 'TEST_ERROR')

        expect(Schema.is(GameErrorSchema)(error)).toBe(true)
      })
    )

    it.effect('should create GameError with default code', () =>
      Effect.gen(function* () {
        const error = createGameError('Test message')

        expect(error.message).toBe('Test message')
        expect(error.code).toBe('UNKNOWN_ERROR')
        expect(error._tag).toBe('GameError')
      })
    )
  })

  describe('EffectConfig Basic Operations', () => {
    it.effect('should create successful Effect', () =>
      Effect.gen(function* () {
        const effect = EffectConfig.succeed('test value')
        const result = Effect.runSync(effect)

        expect(result).toBe('test value')
      })
    )

    it.effect('should create and run simple effects', () =>
      Effect.gen(function* () {
        const effect = EffectConfig.succeed(42)
        const result = runSync(effect)
        expect(result).toBe(42)
      })
    )

    it.effect('should handle failures with fail', () =>
      Effect.gen(function* () {
        const effect = EffectConfig.fail('test error')
        expect(() => runSync(effect)).toThrow('test error')
      })
    )

    it.effect('should handle sync operations', () =>
      Effect.gen(function* () {
        const effect = sync(() => 'hello world')
        const result = runSync(effect)
        expect(result).toBe('hello world')
      })
    )

    it.effect('should compose effects with pipe', () =>
      Effect.gen(function* () {
        const effect = pipe(
          EffectConfig.succeed(5),
          map((n) => n * 2),
          flatMap((n) => EffectConfig.succeed(n + 3))
        )
        const result = runSync(effect)
        expect(result).toBe(13)
      })
    )

    it.effect('should create failed Effect', () =>
      Effect.gen(function* () {
        const effect = EffectConfig.fail('Test error', 'TEST_CODE')

        const result = Effect.runSync(Effect.either(effect))

        expect(result._tag).toBe('Left')
        pipe(
          result,
          Either.match({
            onLeft: (error) => {
              expect(EffectConfig.isGameError(error)).toBe(true)
              if (EffectConfig.isGameError(error)) {
                expect(error.message).toBe('Test error')
                expect(error.code).toBe('TEST_CODE')
              }
            },
            onRight: () => {
              // 失敗ケースなので到達しない
            },
          })
        )
      })
    )

    it.effect('should identify GameError correctly', () =>
      Effect.gen(function* () {
        const gameError = createGameError('Test error')
        const regularObject = { message: 'Not a game error' }

        expect(EffectConfig.isGameError(gameError)).toBe(true)
        expect(EffectConfig.isGameError(regularObject)).toBe(false)
      })
    )
  })

  describe('Error handling', () => {
    it.effect('should catch errors with catchAll', () =>
      Effect.gen(function* () {
        const effect = pipe(
          EffectConfig.fail('error'),
          catchAll(() => EffectConfig.succeed('recovered'))
        )
        const result = runSync(effect)
        expect(result).toBe('recovered')
      })
    )

    it.effect('should map errors', () =>
      Effect.gen(function* () {
        const effect = pipe(
          EffectConfig.fail('original'),
          mapError((e) => createGameError(`mapped: ${e.message}`, e.code))
        )
        expect(() => runSync(effect)).toThrow('mapped: original')
      })
    )

    it.effect('should handle orElse', () =>
      Effect.gen(function* () {
        const effect = pipe(EffectConfig.fail('first'), orElse(EffectConfig.succeed('fallback')))
        const result = runSync(effect)
        expect(result).toBe('fallback')
      })
    )
  })

  describe('Async operations', () => {
    it('should handle promises', async () => {
      const effect = promise(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'async result'
      })
      const result = await runPromise(effect)
      expect(result).toBe('async result')
    })

    it('should handle tryPromise', async () => {
      const effect = tryPromise({
        try: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return 'success'
        },
        catch: (error) => new Error(String(error)),
      })
      const result = await runPromise(effect)
      expect(result).toBe('success')
    })
  })

  describe('Schema validation', () => {
    it.effect('should validate using schema', () =>
      Effect.gen(function* () {
        const stringSchema = Schema.String
        const validator = EffectConfig.validate(stringSchema)

        const validEffect = validator('valid string')
        const result = Effect.runSync(validEffect)
        expect(result).toBe('valid string')

        const invalidEffect = validator(123 as unknown as string)
        const invalidResult = Effect.runSync(Effect.either(invalidEffect))

        expect(invalidResult._tag).toBe('Left')
        pipe(
          invalidResult,
          Either.match({
            onLeft: (error) => {
              expect(EffectConfig.isGameError(error)).toBe(true)
              if (EffectConfig.isGameError(error)) {
                expect(error.code).toBe('VALIDATION_ERROR')
              }
            },
            onRight: () => {
              // 失敗ケースなので到達しない
            },
          })
        )
      })
    )

    it.effect('should validate data with schemas', () =>
      Effect.gen(function* () {
        const schema = Schema.Struct({
          name: Schema.String,
          age: Schema.Number,
        })

        const valid = { name: 'John', age: 30 }
        const effect = EffectConfig.validate(schema)(valid)
        const result = runSync(effect)
        expect(result).toEqual(valid)
      })
    )

    it.effect('should fail validation for invalid data', () =>
      Effect.gen(function* () {
        const schema = Schema.Struct({
          name: Schema.String,
          age: Schema.Number,
        })

        const invalid = { name: 'John', age: 'thirty' } as any
        const effect = EffectConfig.validate(schema)(invalid)
        expect(() => runSync(effect)).toThrow()
      })
    )
  })

  describe('Batch processing', () => {
    it('should process items in batch', async () => {
      const items = [1, 2, 3, 4, 5]
      const effect = batch(items, (n) => EffectConfig.succeed(n * 2), { concurrency: 2 })
      const result = await runPromise(effect)
      expect(result).toEqual([2, 4, 6, 8, 10])
    })
  })

  describe('Logging utilities', () => {
    it.effect('should log messages', () =>
      Effect.gen(function* () {
        const effect = pipe(
          logInfo('info message'),
          Effect.flatMap(() => logDebug('debug message')),
          Effect.flatMap(() => logError('error message'))
        )
        expect(() => runSync(effect)).not.toThrow()
      })
    )
  })

  describe('Performance measurement', () => {
    it('should measure execution time', async () => {
      const effect = timed(
        'test-operation',
        promise(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return 'done'
        })
      )
      const result = await runPromise(effect)
      expect(result).toBe('done')
    })
  })

  describe('Service creation', () => {
    it.effect('should create services with makeService', () =>
      Effect.gen(function* () {
        interface TestService {
          getValue: () => string
        }

        const TestService = makeService<TestService>('TestService')

        expect(TestService).toBeDefined()
        expect(TestService.key).toBe('@app/TestService')
      })
    )
  })

  describe('Layer utilities', () => {
    it.effect('should create layers', () =>
      Effect.gen(function* () {
        interface Config {
          apiUrl: string
        }

        const ConfigTag = Context.GenericTag<Config>('Config')

        const configLayer = layerFrom(ConfigTag, {
          apiUrl: 'http://localhost:3000',
        })

        expect(configLayer).toBeDefined()
      })
    )
  })

  describe('Retry mechanism', () => {
    it('should retry failed effects', async () => {
      let attempts = 0
      const effect = withRetry(
        Effect.suspend(() => {
          attempts++
          if (attempts < 3) {
            return Effect.fail(new Error('not yet'))
          }
          return Effect.succeed('success')
        }),
        { times: 5, delay: 10 }
      )

      const result = await runPromise(effect)
      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })
  })

  describe('Branded Types', () => {
    it.effect('should create PlayerId safely', () =>
      Effect.gen(function* () {
        const playerId = BrandedTypes.createPlayerId('player_123')
        expect(playerId).toBe('player_123')
        expect(Schema.is(PlayerIdSchema)(playerId)).toBe(true)
      })
    )

    it.effect('should create WorldCoordinate safely', () =>
      Effect.gen(function* () {
        const coordinate = BrandedTypes.createWorldCoordinate(100.5)
        expect(coordinate).toBe(100.5)
        expect(Schema.is(WorldCoordinateSchema)(coordinate)).toBe(true)
      })
    )

    it.effect('should create ChunkId safely', () =>
      Effect.gen(function* () {
        const chunkId = BrandedTypes.createChunkId(1, 2)
        expect(chunkId).toBe('chunk_1_2')
        expect(Schema.is(ChunkIdSchema)(chunkId)).toBe(true)
      })
    )

    it.effect('should create BlockTypeId safely', () =>
      Effect.gen(function* () {
        const blockTypeId = BrandedTypes.createBlockTypeId(1)
        expect(blockTypeId).toBe(1)
        expect(Schema.is(BlockTypeIdSchema)(blockTypeId)).toBe(true)
      })
    )

    it.effect('should reject invalid BlockTypeId', () =>
      Effect.gen(function* () {
        expect(() => BrandedTypes.createBlockTypeId(-1)).toThrow()
        expect(() => BrandedTypes.createBlockTypeId(0)).toThrow()
        expect(() => BrandedTypes.createBlockTypeId(1.5)).toThrow()
      })
    )
  })

  describe('Schema Integration', () => {
    it.effect('should decode branded types using Schema', () =>
      Effect.gen(function* () {
        const playerIdResult = Schema.decodeUnknownSync(PlayerIdSchema)('test_player')
        const coordinateResult = Schema.decodeUnknownSync(WorldCoordinateSchema)(42.0)
        const chunkIdResult = Schema.decodeUnknownSync(ChunkIdSchema)('chunk_0_0')
        const blockTypeResult = Schema.decodeUnknownSync(BlockTypeIdSchema)(5)

        expect(playerIdResult).toBe('test_player')
        expect(coordinateResult).toBe(42.0)
        expect(chunkIdResult).toBe('chunk_0_0')
        expect(blockTypeResult).toBe(5)
      })
    )

    it.effect('should validate GameError schema', () =>
      Effect.gen(function* () {
        const error = createGameError('Validation test', 'VALIDATION_ERROR')

        expect(error.message).toBe('Validation test')
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error._tag).toBe('GameError')
        expect(Schema.is(GameErrorSchema)(error)).toBe(true)
      })
    )
  })
})
