import { describe, it, expect } from 'vitest'
import { Effect, pipe } from 'effect'
import * as Schema from 'effect/Schema'
import {
  GameError,
  NetworkError,
  ValidationError,
  ResourceNotFoundError
} from './index'
import type {
  Result,
  CommonError,
  Option,
  NonEmptyArray,
  Predicate,
  Callback,
  DeepReadonly,
  DeepPartial
} from './index'

describe('Types', () => {
  describe('GameError', () => {
    it('should create and validate GameError', () => {
      const errorData = {
        _tag: 'GameError' as const,
        message: 'Test error'
      }
      const error = Schema.decodeSync(GameError)(errorData)

      expect(error._tag).toBe('GameError')
      expect(error.message).toBe('Test error')
    })

    it('should handle optional fields', () => {
      const errorData = {
        _tag: 'GameError' as const,
        message: 'Test error',
        code: 'TEST_001',
        details: { foo: 'bar' }
      }
      const error = Schema.decodeSync(GameError)(errorData)

      expect(error.code).toBe('TEST_001')
      expect(error.details).toEqual({ foo: 'bar' })
    })

    it('should fail validation for invalid data', () => {
      expect(() =>
        Schema.decodeSync(GameError)({
          _tag: 'GameError'
          // missing required message
        } as any)
      ).toThrow()
    })
  })

  describe('NetworkError', () => {
    it('should create NetworkError', () => {
      const errorData = {
        _tag: 'NetworkError' as const,
        message: 'Network failure',
        statusCode: 500,
        url: 'http://example.com'
      }
      const error = Schema.decodeSync(NetworkError)(errorData)

      expect(error._tag).toBe('NetworkError')
      expect(error.statusCode).toBe(500)
      expect(error.url).toBe('http://example.com')
    })
  })

  describe('ValidationError', () => {
    it('should create ValidationError', () => {
      const errorData = {
        _tag: 'ValidationError' as const,
        message: 'Invalid input',
        field: 'email',
        value: 'not-an-email'
      }
      const error = Schema.decodeSync(ValidationError)(errorData)

      expect(error._tag).toBe('ValidationError')
      expect(error.field).toBe('email')
      expect(error.value).toBe('not-an-email')
    })
  })

  describe('ResourceNotFoundError', () => {
    it('should create ResourceNotFoundError', () => {
      const errorData = {
        _tag: 'ResourceNotFoundError' as const,
        message: 'Resource not found',
        resourceType: 'Player',
        resourceId: 'player-123'
      }
      const error = Schema.decodeSync(ResourceNotFoundError)(errorData)

      expect(error._tag).toBe('ResourceNotFoundError')
      expect(error.resourceType).toBe('Player')
      expect(error.resourceId).toBe('player-123')
    })

    it('should require all fields', () => {
      expect(() =>
        Schema.decodeSync(ResourceNotFoundError)({
          _tag: 'ResourceNotFoundError',
          message: 'Not found'
          // missing resourceType and resourceId
        } as any)
      ).toThrow()
    })
  })

  describe('Result type', () => {
    it('should work with Effect type', () => {
      const successResult: Result<number> = Effect.succeed(42)
      const failResult: Result<number, string> = Effect.fail('error')

      expect(Effect.runSync(successResult)).toBe(42)
      expect(() => Effect.runSync(failResult)).toThrow()
    })
  })

  describe('CommonError union type', () => {
    it('should accept any error type from the union', () => {
      const gameError = Schema.decodeSync(GameError)({ _tag: 'GameError' as const, message: 'game error' })
      const networkError = Schema.decodeSync(NetworkError)({ _tag: 'NetworkError' as const, message: 'network error' })
      const validationError = Schema.decodeSync(ValidationError)({ _tag: 'ValidationError' as const, message: 'validation error' })
      const notFoundError = Schema.decodeSync(ResourceNotFoundError)({
        _tag: 'ResourceNotFoundError' as const,
        message: 'not found',
        resourceType: 'Item',
        resourceId: '123'
      })

      const errors: CommonError[] = [gameError, networkError, validationError, notFoundError]

      errors.forEach(error => {
        expect(error._tag).toBeTruthy()
        expect(error.message).toBeTruthy()
      })
    })
  })

  describe('Option type', () => {
    it('should handle different option values', () => {
      const some: Option<number> = 42
      const none1: Option<number> = null
      const none2: Option<number> = undefined

      expect(some).toBe(42)
      expect(none1).toBeNull()
      expect(none2).toBeUndefined()
    })
  })

  describe('NonEmptyArray type', () => {
    it('should require at least one element', () => {
      const arr: NonEmptyArray<number> = [1, 2, 3]
      const single: NonEmptyArray<string> = ['hello']

      expect(arr.length).toBeGreaterThan(0)
      expect(single.length).toBe(1)

      // TypeScript will prevent empty array at compile time
      // const invalid: NonEmptyArray<number> = [] // This would be a compile error
    })
  })

  describe('Predicate type', () => {
    it('should work as a boolean function', () => {
      const isEven: Predicate<number> = (n) => n % 2 === 0
      const isLongString: Predicate<string> = (s) => s.length > 10

      expect(isEven(4)).toBe(true)
      expect(isEven(3)).toBe(false)
      expect(isLongString('hello world!')).toBe(true)
      expect(isLongString('hi')).toBe(false)
    })
  })

  describe('Callback types', () => {
    it('should handle sync callbacks', () => {
      let value = 0
      const callback: Callback<number> = (n) => {
        value = n
      }

      callback(42)
      expect(value).toBe(42)
    })

    it('should handle void callbacks', () => {
      let called = false
      const voidCallback: Callback = () => {
        called = true
      }

      voidCallback(undefined)
      expect(called).toBe(true)
    })
  })

  describe('DeepReadonly type', () => {
    it('should make nested objects readonly', () => {
      interface User {
        name: string
        settings: {
          theme: string
          notifications: {
            email: boolean
          }
        }
      }

      const user: DeepReadonly<User> = {
        name: 'John',
        settings: {
          theme: 'dark',
          notifications: {
            email: true
          }
        }
      }

      // These would be compile-time errors:
      // user.name = 'Jane'
      // user.settings.theme = 'light'
      // user.settings.notifications.email = false

      expect(user.name).toBe('John')
      expect(user.settings.theme).toBe('dark')
    })
  })

  describe('DeepPartial type', () => {
    it('should make nested properties optional', () => {
      interface Config {
        server: {
          host: string
          port: number
          ssl: {
            enabled: boolean
            cert: string
          }
        }
      }

      const partial1: DeepPartial<Config> = {}
      const partial2: DeepPartial<Config> = {
        server: {
          host: 'localhost'
          // port and ssl are optional
        }
      }
      const partial3: DeepPartial<Config> = {
        server: {
          ssl: {
            enabled: true
            // cert is optional
          }
        }
      }

      expect(partial1).toEqual({})
      expect(partial2.server?.host).toBe('localhost')
      expect(partial3.server?.ssl?.enabled).toBe(true)
    })
  })
})