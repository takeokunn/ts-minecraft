import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Either, Option, Schema } from 'effect'
import { InitError, ConfigError, isInitError, isConfigError } from '../AppError'

describe('AppError with Effect-TS patterns', () => {
  describe('Error creation and validation', () => {
  it.effect('should create and validate InitError', () => Effect.gen(function* () {
    const messages = ['Initialization failed', 'Database connection error', 'Service startup failed', '']
    for (const message of messages) {
    const error = InitError(message)
    expect(error._tag).toBe('InitError')
    expect(error.message).toBe(message)
    expect(isInitError(error)).toBe(true)
    expect(isConfigError(error)).toBe(false)
    }
})
),
  Effect.gen(function* () {
        const testCases = [
          { message: 'Invalid value', path: 'server.port' },
          { message: 'Missing field', path: 'database.url' },
          { message: 'Type mismatch', path: 'cache.ttl' },
          { message: '', path: '' },
        ]
        for (const { message, path } of testCases) {
          const error = ConfigError(message, path)
          expect(error._tag).toBe('ConfigError')
          expect(error.message).toBe(message)
          expect(error.path).toBe(path)
          expect(isConfigError(error)).toBe(true)
          expect(isInitError(error)).toBe(false)
        }
      })
    it.effect('should handle InitError with cause', () => Effect.gen(function* () {
    const originalError = new Error('Root cause')
    const initError = InitError('Initialization failed', originalError)
    expect(initError._tag).toBe('InitError')
    expect(initError.message).toBe('Initialization failed')
    expect(initError.cause).toBe(originalError)
    expect(isInitError(initError)).toBe(true)
  })
),
    Effect.gen(function* () {
    const configError = ConfigError('Invalid port number', 'server.network.port')

    expect(configError._tag).toBe('ConfigError')
    expect(configError.message).toBe('Invalid port number')
    expect(configError.path).toBe('server.network.port')
    expect(isConfigError(configError)).toBe(true)
    })
    })

    describe('Error type guards and pattern matching', () => {
  it.effect('should correctly identify error types in mixed arrays', () => Effect.gen(function* () {
    const errors = [
    InitError('Init failed'),
    ConfigError('Config invalid', 'app.debug'),
    InitError('Another init error'
    }),
    ConfigError('Type error', 'server.port'),
    ]
    const initErrors = errors.filter(isInitError)
    const configErrors = errors.filter(isConfigError)
    expect(initErrors).toHaveLength(2)
    expect(configErrors).toHaveLength(2)
    expect(initErrors.every(e => e._tag === 'InitError')).toBe(true)
    expect(configErrors.every(e => e._tag === 'ConfigError')).toBe(true)
})
),
  Effect.gen(function* () {
        const successValue = 'success'
        const initError = InitError('Failed to initialize')
        const configError = ConfigError('Invalid config', 'path.to.field')

        const successResult = Either.right(successValue)
        const initErrorResult = Either.left(initError)
        const configErrorResult = Either.left(configError)

        expect(Either.isRight(successResult)).toBe(true)
        expect(Either.isLeft(initErrorResult)).toBe(true)
        expect(Either.isLeft(configErrorResult)).toBe(true)

        if (Either.isRight(successResult)) {
          expect(successResult.right).toBe(successValue)
        }

        if (Either.isLeft(initErrorResult)) {
          expect(isInitError(initErrorResult.left)).toBe(true)
        }

        if (Either.isLeft(configErrorResult)) {
          expect(isConfigError(configErrorResult.left)).toBe(true)
        }
      })
    it.effect('should work with Option patterns', () => Effect.gen(function* () {
    const maybeInitError = Option.some(InitError('Optional init error'))
    const maybeConfigError = Option.some(ConfigError('Optional config error', 'optional.path'))
    const noError = Option.none()
    expect(Option.isSome(maybeInitError)).toBe(true)
    expect(Option.isSome(maybeConfigError)).toBe(true)
    expect(Option.isNone(noError)).toBe(true)
    if (Option.isSome(maybeInitError)) {
    expect(isInitError(maybeInitError.value)).toBe(true)
    }
    if (Option.isSome(maybeConfigError)) {
    expect(isConfigError(maybeConfigError.value)).toBe(true)
    }
  })
)
    describe('Schema integration patterns', () => {
  it.effect('should create schemas for error validation', () => Effect.gen(function* () {
    // Schema for InitError
    const InitErrorSchema = Schema.Struct({
    _tag: Schema.Literal('InitError'
    }),
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
})
    // Schema for ConfigError
    const ConfigErrorSchema = Schema.Struct({
    _tag: Schema.Literal('ConfigError'),
    message: Schema.String,
    path: Schema.String,
  })
)
    // Validate using schemas
    const initResult = Schema.decodeUnknownSync(InitErrorSchema)(initError)
    const configResult = Schema.decodeUnknownSync(ConfigErrorSchema)(configError)

    expect(initResult._tag).toBe('InitError')
    expect(initResult.message).toBe('Test init error')

    expect(configResult._tag).toBe('ConfigError')
    expect(configResult.message).toBe('Test config error')
    expect(configResult.path).toBe('test.path')})

    it.effect('should handle invalid data with schemas', () => Effect.gen(function* () {
    const ErrorSchema = Schema.Union(
    Schema.Struct({
    _tag: Schema.Literal('InitError'
    }),
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    }),
    Schema.Struct({
    _tag: Schema.Literal('ConfigError'),
    message: Schema.String,
    path: Schema.String,
  })
)
    const validConfigError = ConfigError('Valid config', 'valid.path')
    const invalidData = { _tag: 'UnknownError', message: 'Invalid' }

    const validInitResult = Schema.decodeUnknownEither(ErrorSchema)(validInitError)
    const validConfigResult = Schema.decodeUnknownEither(ErrorSchema)(validConfigError)
    const invalidResult = Schema.decodeUnknownEither(ErrorSchema)(invalidData)

    expect(Either.isRight(validInitResult)).toBe(true)
    expect(Either.isRight(validConfigResult)).toBe(true)
    expect(Either.isLeft(invalidResult)).toBe(true)
    })
    })

    describe('Effect integration patterns', () => {
  it.effect('should work with Effect.fail and Effect.succeed', () => Effect.gen(function* () {
    const successEffect = Effect.succeed('success')
    const initErrorEffect = Effect.fail(InitError('Init failed'))
    const configErrorEffect = Effect.fail(ConfigError('Config failed', 'config.path'))
    const successResult = yield* Effect.either(successEffect)
    const initErrorResult = yield* Effect.either(initErrorEffect)
    const configErrorResult = yield* Effect.either(configErrorEffect)
    expect(Either.isRight(successResult)).toBe(true)
    expect(Either.isLeft(initErrorResult)).toBe(true)
    expect(Either.isLeft(configErrorResult)).toBe(true)
    if (Either.isLeft(initErrorResult)) {
    expect(isInitError(initErrorResult.left)).toBe(true)
    }
    if (Either.isLeft(configErrorResult)) {
    expect(isConfigError(configErrorResult.left)).toBe(true)
    }
})
),
  Effect.gen(function* () {
        const baseEffect = Effect.fail(InitError('Base error'))

        const transformedEffect = baseEffect.pipe(
          Effect.mapError(error => ConfigError(`Transformed: ${error.message}`, 'transformed.path')),
          Effect.either
        )

        const result = yield* transformedEffect

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(isConfigError(result.left)).toBe(true)
          expect(result.left.message).toBe('Transformed: Base error')
          expect(result.left.path).toBe('transformed.path')
        }
      })
    it.effect('should handle error recovery patterns', () => Effect.gen(function* () {
    const failingEffect = Effect.fail(InitError('Initial failure'))
    const recoveredEffect = failingEffect.pipe(
    Effect.catchAll(error => {
    if (isInitError(error)) {
    return Effect.succeed(`Recovered from: ${error.message}`)
    }
    return Effect.fail(error)
    })
    const result = yield* recoveredEffect
    expect(result).toBe('Recovered from: Initial failure')
  })
),
  Effect.gen(function* () {
    const errors = [
    InitError('Error 1'),
    ConfigError('Error 2', 'path.1'),
    InitError('Error 3'
    }),
    ConfigError('Error 4', 'path.2'),
    ]

    const initErrorCount = errors.filter(isInitError).length
    const configErrorCount = errors.filter(isConfigError).length

    expect(initErrorCount).toBe(2)
    expect(configErrorCount).toBe(2)
    expect(errors).toHaveLength(4)

    // Test error message aggregation
    const allMessages = errors.map(e => e.message)
    expect(allMessages).toEqual(['Error 1', 'Error 2', 'Error 3', 'Error 4'])
  })
  })
})