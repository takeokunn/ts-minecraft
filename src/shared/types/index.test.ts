import { describe, it, expect } from 'vitest'
import { Effect, pipe } from 'effect'
import * as Schema from 'effect/Schema'
import {
  GameError,
  GameErrorSchema,
  NetworkError,
  NetworkErrorSchema,
  ValidationError,
  ValidationErrorSchema,
  ResourceNotFoundError,
  ResourceNotFoundErrorSchema
} from '../errors'
import type { AllErrors } from '../errors'
import type {
  Option,
  NonEmptyArray,
  Predicate,
  Callback,
  DeepReadonly,
  DeepPartial
} from './index'

// Effect-TSのResult型を直接定義
type Result<A, E = Error> = Effect.Effect<A, E>

describe('Types', () => {
  describe('GameError', () => {
    it('should create and validate GameError', () => {
      const error = GameError({
        message: 'Test error'
      })

      expect(error._tag).toBe('GameError')
      expect(error.message).toBe('Test error')
    })

    it('should handle optional fields', () => {
      const error = GameError({
        message: 'Test error',
        code: 'TEST_001',
        cause: { foo: 'bar' }
      })

      expect(error.code).toBe('TEST_001')
      expect(error.cause).toEqual({ foo: 'bar' })
    })

    it('should validate with schema', () => {
      const errorData = {
        _tag: 'GameError' as const,
        message: 'Test error'
      }
      const error = Schema.decodeSync(GameErrorSchema)(errorData)

      expect(error._tag).toBe('GameError')
      expect(error.message).toBe('Test error')
    })

    it('should fail validation for invalid data', () => {
      expect(() =>
        Schema.decodeSync(GameErrorSchema)({
          _tag: 'GameError'
          // missing required message
        } as any)
      ).toThrow()
    })
  })

  describe('NetworkError', () => {
    it('should create NetworkError', () => {
      const error = NetworkError({
        message: 'Network failure',
        statusCode: 500,
        code: 'NETWORK_500'
      })

      expect(error._tag).toBe('NetworkError')
      expect(error.statusCode).toBe(500)
      expect(error.code).toBe('NETWORK_500')
    })
  })

  describe('ValidationError', () => {
    it('should create ValidationError', () => {
      const error = ValidationError({
        message: 'Invalid input',
        field: 'email',
        value: 'not-an-email'
      })

      expect(error._tag).toBe('ValidationError')
      expect(error.field).toBe('email')
      expect(error.value).toBe('not-an-email')
    })
  })

  describe('ResourceNotFoundError', () => {
    it('should create ResourceNotFoundError', () => {
      const error = ResourceNotFoundError({
        message: 'Resource not found',
        resourceType: 'Player',
        resourceId: 'player-123'
      })

      expect(error._tag).toBe('ResourceNotFoundError')
      expect(error.resourceType).toBe('Player')
      expect(error.resourceId).toBe('player-123')
    })

    it('should require all fields', () => {
      expect(() =>
        Schema.decodeSync(ResourceNotFoundErrorSchema)({
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

  describe('AllErrors union type', () => {
    it('should accept any error type from the union', () => {
      const gameError = GameError({ message: 'game error' })
      const networkError = NetworkError({ message: 'network error' })
      const validationError = ValidationError({ message: 'validation error', field: 'test', value: 'invalid' })
      const notFoundError = ResourceNotFoundError({
        message: 'not found',
        resourceType: 'Item',
        resourceId: '123'
      })

      const errors: AllErrors[] = [gameError, networkError, validationError, notFoundError]

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