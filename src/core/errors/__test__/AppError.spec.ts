import { describe, it, expect } from 'vitest'
import { pipe } from 'effect'
import { Match } from 'effect'
import { InitError, ConfigError } from '../AppError'

describe('AppError Module', () => {
  describe('InitError', () => {
    it('should create InitError with required fields', () => {
      const error = InitError('Initialization failed')

      expect(error.message).toBe('Initialization failed')
      expect(error._tag).toBe('InitError')
      expect(error.cause).toBeUndefined()
    })

    it('should create InitError with cause', () => {
      const cause = new Error('Root cause')
      const error = InitError('Initialization failed', cause)

      expect(error.message).toBe('Initialization failed')
      expect(error._tag).toBe('InitError')
      expect(error.cause).toBe(cause)
    })

    it('should have correct discriminated union type', () => {
      const error = InitError('test')
      expect(error._tag).toBe('InitError')

      // Type check: InitError should not have 'path' property
      expect('path' in error).toBe(false)
    })
  })

  describe('ConfigError', () => {
    it('should create ConfigError with required fields', () => {
      const error = ConfigError('Configuration failed', '/config/test.yaml')

      expect(error.message).toBe('Configuration failed')
      expect(error._tag).toBe('ConfigError')
      expect(error.path).toBe('/config/test.yaml')
    })

    it('should create ConfigError with path and message', () => {
      const error = ConfigError('Configuration failed', '/config/test.yaml')

      expect(error.message).toBe('Configuration failed')
      expect(error._tag).toBe('ConfigError')
      expect(error.path).toBe('/config/test.yaml')
    })

    it('should have correct discriminated union type', () => {
      const error = ConfigError('test', '/path')
      expect(error._tag).toBe('ConfigError')
      expect(error.path).toBe('/path')

      // Type check: ConfigError should have 'path' property
      expect('path' in error).toBe(true)
    })
  })

  describe('Error Type Discrimination', () => {
    it('should distinguish between error types using _tag', () => {
      const initError = InitError('Init failed')
      const configError = ConfigError('Config failed', '/config/test.yaml')

      expect(initError._tag).toBe('InitError')
      expect(configError._tag).toBe('ConfigError')
    })

    it('should have proper Error prototype chain', () => {
      const initError = InitError('Init failed')
      const configError = ConfigError('Config failed', '/config/test.yaml')

      expect(initError instanceof Error).toBe(true)
      expect(configError instanceof Error).toBe(true)
    })

    it('should maintain type safety with discriminated unions', () => {
      const initError = InitError('Init failed')
      const configError = ConfigError('Config failed', 'test')

      // _tagによる型判定をMatch.valueパターンに変換
      const checkErrorType = (error: typeof initError | typeof configError) => {
        return pipe(
          Match.value(error._tag),
          Match.when('InitError', () => ({ type: 'init', hasPath: false })),
          Match.when('ConfigError', () => ({
            type: 'config',
            hasPath: true,
            path: (error as typeof configError).path,
          })),
          Match.orElse(() => ({ type: 'unknown', hasPath: false }))
        )
      }

      const initResult = checkErrorType(initError)
      const configResult = checkErrorType(configError)

      expect(initResult.type).toBe('init')
      expect(initResult.hasPath).toBe(false)

      expect(configResult.type).toBe('config')
      expect(configResult.hasPath).toBe(true)
      expect('path' in configResult && configResult.path).toBe('test')
    })

    it('should handle error pattern matching correctly', () => {
      const errors = [InitError('Init error'), ConfigError('Config error', '/path/to/config')]

      const results = errors.map((error) => {
        return pipe(
          Match.value(error._tag),
          Match.when('InitError', () => `Init error: ${error.message}`),
          Match.when('ConfigError', () => {
            const configErr = error as ReturnType<typeof ConfigError>
            return `Config error at ${configErr.path}: ${configErr.message}`
          }),
          Match.orElse(() => `Unknown error: ${error.message}`)
        )
      })

      expect(results[0]).toBe('Init error: Init error')
      expect(results[1]).toBe('Config error at /path/to/config: Config error')
    })
  })

  describe('Error Serialization', () => {
    it('should serialize InitError correctly', () => {
      const error = InitError('Serialization test')
      const serialized = JSON.stringify(error)
      const parsed = JSON.parse(serialized)

      expect(parsed.message).toBe('Serialization test')
      expect(parsed._tag).toBe('InitError')
    })

    it('should serialize ConfigError correctly', () => {
      const error = ConfigError('Config serialization test', '/config/path')
      const serialized = JSON.stringify(error)
      const parsed = JSON.parse(serialized)

      expect(parsed.message).toBe('Config serialization test')
      expect(parsed._tag).toBe('ConfigError')
      expect(parsed.path).toBe('/config/path')
    })
  })
})
