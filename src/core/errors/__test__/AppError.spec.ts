import { describe, it, expect } from 'vitest'
import { pipe } from 'effect'
import { Match } from 'effect'
import * as fc from 'fast-check'
import { InitError, ConfigError, isInitError, isConfigError } from '../AppError'

describe('AppError Module', () => {
  describe('InitError', () => {
    it('should create InitError with required fields', () => {
      const error = InitError({ message: 'Initialization failed' })

      expect(error.message).toBe('Initialization failed')
      expect(error._tag).toBe('InitError')
      expect(error.cause).toBeUndefined()
    })

    it('should create InitError with cause', () => {
      const cause = new Error('Root cause')
      const error = InitError({ message: 'Initialization failed', cause: cause })

      expect(error.message).toBe('Initialization failed')
      expect(error._tag).toBe('InitError')
      expect(error.cause).toBe(cause)
    })

    it('should have correct discriminated union type', () => {
      const error = InitError({ message: 'test' })
      expect(error._tag).toBe('InitError')

      // Type check: InitError should not have 'path' property
      expect('path' in error).toBe(false)
    })
  })

  describe('ConfigError', () => {
    it('should create ConfigError with required fields', () => {
      const error = ConfigError({ message: 'Configuration failed', path: '/config/test.yaml' })

      expect(error.message).toBe('Configuration failed')
      expect(error._tag).toBe('ConfigError')
      expect(error.path).toBe('/config/test.yaml')
    })

    it('should create ConfigError with path and message', () => {
      const error = ConfigError({ message: 'Configuration failed', path: '/config/test.yaml' })

      expect(error.message).toBe('Configuration failed')
      expect(error._tag).toBe('ConfigError')
      expect(error.path).toBe('/config/test.yaml')
    })

    it('should have correct discriminated union type', () => {
      const error = ConfigError({ message: 'test', path: '/path' })
      expect(error._tag).toBe('ConfigError')
      expect(error.path).toBe('/path')

      // Type check: ConfigError should have 'path' property
      expect('path' in error).toBe(true)
    })
  })

  describe('Error Type Discrimination', () => {
    it('should distinguish between error types using _tag', () => {
      const initError = InitError({ message: 'Init failed' })
      const configError = ConfigError({ message: 'Config failed', path: '/config/test.yaml' })

      expect(initError._tag).toBe('InitError')
      expect(configError._tag).toBe('ConfigError')
    })

    it('should have proper Error prototype chain', () => {
      const initError = InitError({ message: 'Init failed' })
      const configError = ConfigError({ message: 'Config failed', path: '/config/test.yaml' })

      expect(initError instanceof Error).toBe(true)
      expect(configError instanceof Error).toBe(true)
    })

    it('should maintain type safety with discriminated unions', () => {
      const initError = InitError({ message: 'Init failed' })
      const configError = ConfigError({ message: 'Config failed', path: 'test' })

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
      const errors = [
        InitError({ message: 'Init error' }),
        ConfigError({ message: 'Config error', path: '/path/to/config' }),
      ]

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
      const error = InitError({ message: 'Serialization test' })
      const serialized = JSON.stringify(error)
      const parsed = JSON.parse(serialized)

      expect(parsed.message).toBe('Serialization test')
      expect(parsed._tag).toBe('InitError')
    })

    it('should serialize ConfigError correctly', () => {
      const error = ConfigError({ message: 'Config serialization test', path: '/config/path' })
      const serialized = JSON.stringify(error)
      const parsed = JSON.parse(serialized)

      expect(parsed.message).toBe('Config serialization test')
      expect(parsed._tag).toBe('ConfigError')
      expect(parsed.path).toBe('/config/path')
    })
  })

  describe('Type Guards', () => {
    describe('isInitError', () => {
      it('should return true for InitError', () => {
        const error = InitError({ message: 'Test error' })
        expect(isInitError(error)).toBe(true)
      })

      it('should return true for InitError with cause', () => {
        const error = InitError({ message: 'Test error', cause: new Error('cause') })
        expect(isInitError(error)).toBe(true)
      })

      it('should return false for ConfigError', () => {
        const error = ConfigError({ message: 'Config error', path: 'path' })
        expect(isInitError(error)).toBe(false)
      })

      it('should return false for non-error objects', () => {
        expect(isInitError(null)).toBe(false)
        expect(isInitError(undefined)).toBe(false)
        expect(isInitError({})).toBe(false)
        expect(isInitError({ _tag: 'OtherError' })).toBe(false)
        expect(isInitError({ message: 'test' })).toBe(false)
        expect(isInitError({ message: 'string' })).toBe(false)
        expect(isInitError(123)).toBe(false)
        expect(isInitError(true)).toBe(false)
      })

      it('should handle edge cases', () => {
        expect(isInitError({ _tag: 'InitError', message: 'test' })).toBe(true)
        expect(isInitError({ _tag: 'InitError', message: 'test', cause: 'cause' })).toBe(true)
        expect(isInitError({ _tag: 'InitError' })).toBe(true) // _tagだけでも判定可能
      })
    })

    describe('isConfigError', () => {
      it('should return true for ConfigError', () => {
        const error = ConfigError({ message: 'Config error', path: 'path' })
        expect(isConfigError(error)).toBe(true)
      })

      it('should return false for InitError', () => {
        const error = InitError({ message: 'Init error' })
        expect(isConfigError(error)).toBe(false)
      })

      it('should return false for non-error objects', () => {
        expect(isConfigError(null)).toBe(false)
        expect(isConfigError(undefined)).toBe(false)
        expect(isConfigError({})).toBe(false)
        expect(isConfigError({ _tag: 'OtherError' })).toBe(false)
        expect(isConfigError({ message: 'test', path: 'path' })).toBe(false)
        expect(isConfigError('string')).toBe(false)
        expect(isConfigError(123)).toBe(false)
        expect(isConfigError(false)).toBe(false)
      })

      it('should handle edge cases', () => {
        expect(isConfigError({ _tag: 'ConfigError', message: 'test', path: 'path' })).toBe(true)
        expect(isConfigError({ _tag: 'ConfigError' })).toBe(true) // _tagだけでも判定可能
      })
    })
  })

  describe('Property-Based Testing', () => {
    describe('InitError PBT', () => {
      it('should always create valid InitError with any string message', () => {
        fc.assert(
          fc.property(fc.string(), (message: string) => {
            const error = InitError({ message })

            expect(error._tag).toBe('InitError')
            expect(error.message).toBe(message)
            expect(isInitError(error)).toBe(true)
            expect(isConfigError(error)).toBe(false)
          })
        )
      })

      it('should handle any type of cause correctly', () => {
        fc.assert(
          fc.property(
            fc.string(),
            fc.oneof(
              fc.constant(undefined),
              fc.string(),
              fc.integer(),
              fc.object(),
              fc.constant(new Error('test')),
              fc.constant(null)
            ),
            (message, cause) => {
              const error = InitError({ message, cause })

              expect(error._tag).toBe('InitError')
              expect(error.message).toBe(message)

              if (cause === undefined) {
                expect(error.cause).toBeUndefined()
                expect('cause' in error).toBe(false)
              } else {
                expect(error.cause).toBe(cause)
              }

              expect(isInitError(error)).toBe(true)
            }
          )
        )
      })
    })

    describe('ConfigError PBT', () => {
      it('should always create valid ConfigError with any strings', () => {
        fc.assert(
          fc.property(fc.string(), fc.string(), (message: string, path: string) => {
            const error = ConfigError({ message, path })

            expect(error._tag).toBe('ConfigError')
            expect(error.message).toBe(message)
            expect(error.path).toBe(path)
            expect(isConfigError(error)).toBe(true)
            expect(isInitError(error)).toBe(false)
          })
        )
      })

      it('should handle special string characters correctly', () => {
        const specialStrings = fc.oneof(
          fc.constant(''),
          fc.constant(' '),
          fc.constant('\n'),
          fc.constant('\t'),
          fc.constant('null'),
          fc.constant('undefined'),
          fc.string({ minLength: 0, maxLength: 1000 })
        )

        fc.assert(
          fc.property(specialStrings, specialStrings, (message: string, path: string) => {
            const error = ConfigError({ message, path })

            expect(error._tag).toBe('ConfigError')
            expect(error.message).toBe(message)
            expect(error.path).toBe(path)
            expect(typeof error.message).toBe('string')
            expect(typeof error.path).toBe('string')
          })
        )
      })
    })

    describe('Type Guard PBT', () => {
      it('should correctly identify any valid InitError object', () => {
        fc.assert(
          fc.property(fc.string(), fc.anything(), (message: string, cause: any) => {
            const validError = InitError({ message, cause })
            const manualError = { _tag: 'InitError' as const, message }

            expect(isInitError(validError)).toBe(true)
            expect(isInitError(manualError)).toBe(true)
          })
        )
      })

      it('should correctly identify any valid ConfigError object', () => {
        fc.assert(
          fc.property(fc.string(), fc.string(), (message: string, path: string) => {
            const validError = ConfigError({ message, path })
            const manualError = { _tag: 'ConfigError' as const, message, path }

            expect(isConfigError(validError)).toBe(true)
            expect(isConfigError(manualError)).toBe(true)
          })
        )
      })

      it('should never misidentify random objects as errors', () => {
        fc.assert(
          fc.property(
            fc
              .anything()
              .filter(
                (val) =>
                  !(
                    typeof val === 'object' &&
                    val !== null &&
                    '_tag' in val &&
                    (val._tag === 'InitError' || val._tag === 'ConfigError')
                  )
              ),
            (value) => {
              expect(isInitError(value)).toBe(false)
              expect(isConfigError(value)).toBe(false)
            }
          )
        )
      })
    })
  })
})
