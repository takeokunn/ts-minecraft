import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Either, Option, Schema } from 'effect'
import * as fc from 'fast-check'
import { InitError, ConfigError, isInitError, isConfigError } from '../AppError'

describe('AppError with Effect-TS patterns', () => {
  describe('Error creation and validation', () => {
    it.effect('should create and validate InitError', () =>
      Effect.gen(function* () {
        const messages = ['Initialization failed', 'Database connection error', 'Service startup failed', '']

        for (const message of messages) {
          const error = InitError(message)

          expect(error._tag).toBe('InitError')
          expect(error.message).toBe(message)
          expect(isInitError(error)).toBe(true)
          expect(isConfigError(error)).toBe(false)
        }
      })
    )

    it.effect('should create and validate ConfigError', () =>
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
    )

    it.effect('should handle InitError with cause', () =>
      Effect.gen(function* () {
        const causes = [new Error('Root cause'), 'String cause', { error: 'Object cause' }, null, undefined]

        for (const cause of causes) {
          const error = InitError('Failed', cause)

          expect(error._tag).toBe('InitError')
          expect(error.message).toBe('Failed')

          if (cause !== undefined) {
            expect(error.cause).toBe(cause)
          } else {
            expect('cause' in error).toBe(false)
          }

          expect(isInitError(error)).toBe(true)
        }
      })
    )
  })

  describe('Effect-based error handling', () => {
    it.effect('should handle errors in Effect context', () =>
      Effect.gen(function* () {
        const initError = InitError('Init failed')
        const configError = ConfigError('Config invalid', 'test.path')

        // Test failing with InitError
        const initResult = yield* Effect.fail(initError).pipe(Effect.either)
        expect(initResult._tag).toBe('Left')
        if (initResult._tag === 'Left') {
          expect(isInitError(initResult.left)).toBe(true)
        }

        // Test failing with ConfigError
        const configResult = yield* Effect.fail(configError).pipe(Effect.either)
        expect(configResult._tag).toBe('Left')
        if (configResult._tag === 'Left') {
          expect(isConfigError(configResult.left)).toBe(true)
        }
      })
    )

    it.effect('should recover from specific error types', () =>
      Effect.gen(function* () {
        const handleInitError = (error: InitError) => Effect.succeed(`Recovered from init: ${error.message}`)

        const handleConfigError = (error: ConfigError) => Effect.succeed(`Recovered from config: ${error.path}`)

        // Test InitError recovery
        const initResult = yield* Effect.fail(InitError('Test')).pipe(Effect.catchIf(isInitError, handleInitError))
        expect(initResult).toBe('Recovered from init: Test')

        // Test ConfigError recovery
        const configResult = yield* Effect.fail(ConfigError('Test', 'path')).pipe(
          Effect.catchIf(isConfigError, handleConfigError)
        )
        expect(configResult).toBe('Recovered from config: path')

        // Test no recovery for wrong type
        const noRecovery = yield* Effect.fail(InitError('Test')).pipe(
          Effect.catchIf(isConfigError, () => Effect.succeed('should not reach here')),
          Effect.either
        )
        expect(noRecovery._tag).toBe('Left')
      })
    )

    it.effect('should chain error handlers', () =>
      Effect.gen(function* () {
        const program = (shouldFailInit: boolean, shouldFailConfig: boolean) =>
          Effect.gen(function* () {
            if (shouldFailInit) {
              yield* Effect.fail(InitError('Init error'))
            }
            if (shouldFailConfig) {
              yield* Effect.fail(ConfigError('Config error', 'test'))
            }
            return 'success'
          }).pipe(
            Effect.catchIf(isInitError, () => Effect.succeed('handled init')),
            Effect.catchIf(isConfigError, () => Effect.succeed('handled config'))
          )

        const successResult = yield* program(false, false)
        expect(successResult).toBe('success')

        const initResult = yield* program(true, false)
        expect(initResult).toBe('handled init')

        const configResult = yield* program(false, true)
        expect(configResult).toBe('handled config')
      })
    )
  })

  describe('Error transformation patterns', () => {
    it.effect('should map between error types', () =>
      Effect.gen(function* () {
        const initToConfig = (error: InitError): ConfigError => ConfigError(error.message, 'initialization')

        const result = yield* Effect.fail(InitError('Test')).pipe(Effect.mapError(initToConfig), Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(isConfigError(result.left)).toBe(true)
          expect(result.left.path).toBe('initialization')
        }
      })
    )

    it.effect('should aggregate multiple errors', () =>
      Effect.gen(function* () {
        const effects = [
          Effect.fail(InitError('Error 1')),
          Effect.succeed('Success 1'),
          Effect.fail(ConfigError('Error 2', 'path')),
          Effect.succeed('Success 2'),
        ]

        const results = yield* Effect.all(effects, { mode: 'either' })

        expect(results).toHaveLength(4)
        expect(results[0]?._tag).toBe('Left')
        expect(results[1]?._tag).toBe('Right')
        expect(results[2]?._tag).toBe('Left')
        expect(results[3]?._tag).toBe('Right')

        // Verify error types
        const result0 = results[0]
        if (result0 && result0._tag === 'Left') {
          expect(isInitError(result0.left)).toBe(true)
        }
        const result2 = results[2]
        if (result2 && result2._tag === 'Left') {
          expect(isConfigError(result2.left)).toBe(true)
        }
      })
    )

    it.effect('should work with Option type', () =>
      Effect.gen(function* () {
        const getConfigValue = (key: string): Option.Option<string> => {
          if (key === 'existing') {
            return Option.some('value')
          }
          return Option.none()
        }

        // Success case
        const successResult = yield* Effect.gen(function* () {
          const value = getConfigValue('existing')
          return Option.match(value, {
            onNone: () => Effect.fail(ConfigError('Not found', 'existing')),
            onSome: (v) => Effect.succeed(v),
          })
        }).pipe(Effect.flatten)

        expect(successResult).toBe('value')

        // Failure case
        const failureResult = yield* Effect.gen(function* () {
          const value = getConfigValue('missing')
          return Option.match(value, {
            onNone: () => Effect.fail(ConfigError('Not found', 'missing')),
            onSome: (v) => Effect.succeed(v),
          })
        }).pipe(Effect.flatten, Effect.either)

        expect(failureResult._tag).toBe('Left')
        if (failureResult._tag === 'Left') {
          expect(isConfigError(failureResult.left)).toBe(true)
          expect(failureResult.left.path).toBe('missing')
        }
      })
    )
  })

  describe('Property-based testing with fast-check', () => {
    it.effect('should validate error messages', () =>
      Effect.gen(function* () {
        const messageArb = fc.string({ minLength: 0, maxLength: 100 })

        yield* Effect.try(() =>
          fc.assert(
            fc.property(messageArb, (message) => {
              const initError = InitError(message)
              const configError = ConfigError(message, 'test')

              expect(initError.message).toBe(message)
              expect(configError.message).toBe(message)

              expect(isInitError(initError)).toBe(true)
              expect(isConfigError(configError)).toBe(true)

              // Cross-validation
              expect(isInitError(configError)).toBe(false)
              expect(isConfigError(initError)).toBe(false)
            })
          )
        )
      })
    )

    it.effect('should validate error paths', () =>
      Effect.gen(function* () {
        const pathArb = fc.string({ minLength: 0, maxLength: 50 })

        yield* Effect.try(() =>
          fc.assert(
            fc.property(pathArb, (path) => {
              const error = ConfigError('Test', path)

              expect(error.path).toBe(path)
              expect(isConfigError(error)).toBe(true)
            })
          )
        )
      })
    )

    it.effect('should handle various cause types', () =>
      Effect.gen(function* () {
        const causeArb = fc.oneof(
          fc.constant(undefined),
          fc.constant(null),
          fc.string(),
          fc.integer(),
          fc.object(),
          fc.constant(new Error('test'))
        )

        yield* Effect.try(() =>
          fc.assert(
            fc.property(causeArb, (cause) => {
              const error = InitError('Test', cause)

              expect(error.message).toBe('Test')
              if (cause !== undefined) {
                expect(error.cause).toBe(cause)
              }
              expect(isInitError(error)).toBe(true)
            })
          )
        )
      })
    )
  })

  describe('Advanced error patterns', () => {
    it.effect('should handle retry with exponential backoff', () =>
      Effect.gen(function* () {
        let attempts = 0
        const maxAttempts = 3

        const program = Effect.gen(function* () {
          attempts++
          if (attempts < maxAttempts) {
            return yield* Effect.fail(InitError(`Attempt ${attempts} failed`))
          }
          return 'success'
        }).pipe(
          Effect.retry({
            times: maxAttempts,
          })
        )

        const result = yield* program
        expect(result).toBe('success')
        expect(attempts).toBe(maxAttempts)
      })
    )

    it.effect('should handle circuit breaker pattern', () =>
      Effect.gen(function* () {
        let failureCount = 0
        const threshold = 3

        const service = (shouldFail: boolean) =>
          Effect.gen(function* () {
            if (shouldFail) {
              failureCount++
              if (failureCount >= threshold) {
                return yield* Effect.fail(InitError('Circuit breaker open'))
              }
              return yield* Effect.fail(ConfigError('Service error', 'endpoint'))
            }
            failureCount = 0
            return 'success'
          })

        // Simulate failures
        for (let i = 0; i < threshold - 1; i++) {
          const result = yield* service(true).pipe(Effect.either)
          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(isConfigError(result.left)).toBe(true)
          }
        }

        // Circuit should open
        const openResult = yield* service(true).pipe(Effect.either)
        expect(openResult._tag).toBe('Left')
        if (openResult._tag === 'Left') {
          expect(isInitError(openResult.left)).toBe(true)
          expect(openResult.left.message).toBe('Circuit breaker open')
        }
      })
    )

    it.effect('should handle error aggregation with validation', () =>
      Effect.gen(function* () {
        const validateField = (name: string, value: unknown) => {
          if (value === undefined || value === null) {
            return Effect.fail(ConfigError(`${name} is required`, name))
          }
          if (typeof value !== 'string') {
            return Effect.fail(ConfigError(`${name} must be a string`, name))
          }
          if (value.length === 0) {
            return Effect.fail(ConfigError(`${name} cannot be empty`, name))
          }
          return Effect.succeed(value)
        }

        const validateConfig = (config: Record<string, unknown>) =>
          Effect.all(
            {
              username: validateField('username', config['username']),
              password: validateField('password', config['password']),
              email: validateField('email', config['email']),
            },
            { mode: 'either' }
          )

        // Test with invalid config
        const invalidConfig = {
          username: '',
          password: null,
          email: 123,
        }

        const result = yield* validateConfig(invalidConfig)

        // All fields should have errors
        expect(result['username']._tag).toBe('Left')
        expect(result['password']._tag).toBe('Left')
        expect(result['email']._tag).toBe('Left')

        // Test with valid config
        const validConfig = {
          username: 'user',
          password: 'pass',
          email: 'user@example.com',
        }

        const validResult = yield* validateConfig(validConfig)

        expect(validResult['username']._tag).toBe('Right')
        expect(validResult['password']._tag).toBe('Right')
        expect(validResult['email']._tag).toBe('Right')
      })
    )
  })
})
