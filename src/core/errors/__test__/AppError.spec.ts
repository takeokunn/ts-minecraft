import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { pipe, Effect } from 'effect'
import { Match } from 'effect'
import { InitError, ConfigError, isInitError, isConfigError } from '../AppError'

describe('AppError Module', () => {
  describe('InitError', () => {
  it.effect('should create InitError with required fields', () => Effect.gen(function* () {
    const error = InitError('Initialization failed')
    expect(error.message).toBe('Initialization failed')
    expect(error._tag).toBe('InitError')
    expect(error.cause).toBeUndefined()
})
),
  Effect.gen(function* () {
        const cause = new Error('Root cause')
        const error = InitError('Initialization failed', cause)
        expect(error.message).toBe('Initialization failed')
        expect(error._tag).toBe('InitError')
        expect(error.cause).toBe(cause)
      })
    it.effect('should have correct discriminated union type', () => Effect.gen(function* () {
    const error = InitError('test')
    expect(error._tag).toBe('InitError')
    // Type check: InitError should not have 'path' property
    expect('path' in error).toBe(false)
  })
)
    describe('ConfigError', () => {
  it.effect('should create ConfigError with required fields', () => Effect.gen(function* () {
    const error = ConfigError('Configuration failed', '/config/test.yaml')
    expect(error.message).toBe('Configuration failed')
    expect(error._tag).toBe('ConfigError')
    expect(error.path).toBe('/config/test.yaml')
})
),
  Effect.gen(function* () {
        const error = ConfigError('Configuration failed', '/config/test.yaml')
        expect(error.message).toBe('Configuration failed')
        expect(error._tag).toBe('ConfigError')
        expect(error.path).toBe('/config/test.yaml')
      })
    it.effect('should have correct discriminated union type', () => Effect.gen(function* () {
    const error = ConfigError('test', '/path')
    expect(error._tag).toBe('ConfigError')
    expect(error.path).toBe('/path')
    // Type check: ConfigError should have 'path' property
    expect('path' in error).toBe(true)
  })
)
    describe('Error Type Discrimination', () => {
  it.effect('should distinguish between error types using _tag', () => Effect.gen(function* () {
    const initError = InitError('Init failed')
    const configError = ConfigError('Config failed', '/config/test.yaml')
    expect(initError._tag).toBe('InitError')
    expect(configError._tag).toBe('ConfigError')
})
),
  Effect.gen(function* () {
        const initError = InitError('Init failed')
        const configError = ConfigError('Config failed', '/config/test.yaml')
        expect(initError instanceof Error).toBe(true)
        expect(configError instanceof Error).toBe(true)
      })
    it.effect('should maintain type safety with discriminated unions', () => Effect.gen(function* () {
    const initError = InitError('Init failed')
    const configError = ConfigError('Config failed', 'test')
    // _tagによる型判定をMatch.valueパターンに変換
    const checkErrorType = (error: typeof initError | typeof configError) => {
    return pipe(
    Match.value(error._tag
    }),
    Match.when('InitError', () => ({ type: 'init', hasPath: false
  })
),
    Match.when('ConfigError', () => ({
    type: 'config',
    hasPath: true,
    path: (error as typeof configError).path,
    })),
    Match.orElse(() => ({ type: 'unknown', hasPath: false  
  })
        }

        const initResult = checkErrorType(initError)
        const configResult = checkErrorType(configError)

        expect(initResult.type).toBe('init')
        expect(initResult.hasPath).toBe(false)
        expect(configResult.type).toBe('config')
        expect(configResult.hasPath).toBe(true)
        expect('path' in configResult && configResult.path).toBe('test')
      })
    it.effect('should handle error pattern matching correctly', () => Effect.gen(function* () {
    const errors = [InitError('Init error'), ConfigError('Config error', '/path/to/config')]
    const results = errors.map((error) => {
    return pipe(
    Match.value(error._tag
    }),
    Match.when('InitError', () => `Init error: ${error.message}`),
    Match.when('ConfigError', () => {
    const configErr = error as ReturnType<typeof ConfigError>
    return `Config error at ${configErr.path}: ${configErr.message}`
    }),
    Match.orElse(() => `Unknown error: ${error.message}`)
    )
  })
).toBe('Init error: Init error')
        expect(results[1]).toBe('Config error at /path/to/config: Config error')
      })
  })

  describe('Type Guard Functions', () => {
  it.effect('should correctly identify InitError with isInitError', () => Effect.gen(function* () {
    const initError = InitError('Init failed')
    const configError = ConfigError('Config failed', '/path')
    expect(isInitError(initError)).toBe(true)
    expect(isInitError(configError)).toBe(false)
    expect(isConfigError(initError)).toBe(false)
    expect(isConfigError(configError)).toBe(true)
})
),
  Effect.gen(function* () {
        const errors = [
          InitError('Error 1'),
          ConfigError('Error 2', '/path1'),
          InitError('Error 3'
    }),
    ConfigError('Error 4', '/path2'),
        ]

        const initErrors = errors.filter(isInitError)
        const configErrors = errors.filter(isConfigError)

        expect(initErrors).toHaveLength(2)
        expect(configErrors).toHaveLength(2)
        expect(initErrors.every(e => e._tag === 'InitError')).toBe(true)
        expect(configErrors.every(e => e._tag === 'ConfigError')).toBe(true)
      })
  })

  describe('Error Serialization', () => {
  it.effect('should serialize InitError correctly', () => Effect.gen(function* () {
    const error = InitError('Serialization test')
    const serialized = JSON.stringify(error)
    const parsed = JSON.parse(serialized)
    expect(parsed.message).toBe('Serialization test')
    expect(parsed._tag).toBe('InitError')
})
),
  Effect.gen(function* () {
        const error = ConfigError('Config serialization test', '/test/path')
        const serialized = JSON.stringify(error)
        const parsed = JSON.parse(serialized)

        expect(parsed.message).toBe('Config serialization test')
        expect(parsed._tag).toBe('ConfigError')
        expect(parsed.path).toBe('/test/path')
      })
    it.effect('should handle serialization with causes', () => Effect.gen(function* () {
    const cause = new Error('Original error')
    const error = InitError('Error with cause', cause)
    const serialized = JSON.stringify(error)
    const parsed = JSON.parse(serialized)
    expect(parsed.message).toBe('Error with cause')
    expect(parsed._tag).toBe('InitError')
    // Note: Error objects don't serialize well, this tests the behavior
    expect(parsed.cause).toBeDefined()
  })
)
    describe('Error inheritance and instanceof checks', () => {
  it.effect('should maintain Error inheritance', () => Effect.gen(function* () {
    const initError = InitError('Test init error')
    const configError = ConfigError('Test config error', '/test')
    expect(initError instanceof Error).toBe(true)
    expect(configError instanceof Error).toBe(true)
    expect(initError.name).toBe('InitError')
    expect(configError.name).toBe('ConfigError')
})
),
  Effect.gen(function* () {
        const error = InitError('Stack trace test')
        expect(error.stack).toBeDefined()
        expect(typeof error.stack).toBe('string')
        expect(error.stack?.includes('InitError')).toBe(true)
      })
  })
})