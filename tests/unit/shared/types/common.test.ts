import { describe, it, expect } from 'vitest'
import * as Either from 'effect/Either'
import * as Option from 'effect/Option'
import * as Effect from 'effect/Effect'
import * as Brand from 'effect/Brand'
import { Result } from '@shared/types/common'
import type { 
  Maybe, 
  Optional, 
  Nullable, 
  EffectFn, 
  SyncFn,
  DeepPartial,
  DeepRequired,
  Mutable,
  NonEmptyArray,
  Head,
  Tail,
  StringKeys,
  NumberKeys,
  ID
} from '@shared/types/common'

describe('common types', () => {
  describe('Maybe type', () => {
    it('should work with Option.some', () => {
      const value: Maybe<string> = Option.some('hello')
      
      expect(Option.isSome(value)).toBe(true)
      if (Option.isSome(value)) {
        expect(value.value).toBe('hello')
      }
    })

    it('should work with Option.none', () => {
      const value: Maybe<string> = Option.none()
      
      expect(Option.isNone(value)).toBe(true)
    })
  })

  describe('Optional and Nullable types', () => {
    it('should allow undefined for Optional', () => {
      const value: Optional<string> = undefined
      expect(value).toBeUndefined()
      
      const definedValue: Optional<string> = 'hello'
      expect(definedValue).toBe('hello')
    })

    it('should allow null for Nullable', () => {
      const value: Nullable<string> = null
      expect(value).toBeNull()
      
      const definedValue: Nullable<string> = 'hello'
      expect(definedValue).toBe('hello')
    })
  })

  describe('Function types', () => {
    it('should work with EffectFn', async () => {
      const effectFn: EffectFn<string> = () => Effect.succeed('hello')
      
      const result = await Effect.runPromise(effectFn())
      expect(result).toBe('hello')
    })

    it('should work with SyncFn', () => {
      const syncFn: SyncFn<number> = () => 42
      
      const result = syncFn()
      expect(result).toBe(42)
    })
  })

  describe('Object utility types', () => {
    it('should create DeepPartial types', () => {
      interface User {
        id: number
        profile: {
          name: string
          email: string
          settings: {
            theme: string
            notifications: boolean
          }
        }
      }

      const partialUser: DeepPartial<User> = {
        profile: {
          name: 'John',
          settings: {
            theme: 'dark'
            // notifications is optional due to DeepPartial
          }
        }
        // id is optional due to DeepPartial
      }
      
      expect(partialUser.profile?.name).toBe('John')
      expect(partialUser.profile?.settings?.theme).toBe('dark')
    })

    it('should create Mutable types', () => {
      interface ReadonlyUser {
        readonly id: number
        readonly name: string
      }

      const mutableUser: Mutable<ReadonlyUser> = {
        id: 1,
        name: 'John'
      }
      
      // This should be allowed due to Mutable
      mutableUser.id = 2
      mutableUser.name = 'Jane'
      
      expect(mutableUser.id).toBe(2)
      expect(mutableUser.name).toBe('Jane')
    })
  })

  describe('Array utility types', () => {
    it('should work with NonEmptyArray', () => {
      const nonEmpty: NonEmptyArray<number> = [1, 2, 3]
      
      expect(nonEmpty.length).toBeGreaterThan(0)
      expect(nonEmpty[0]).toBe(1)
    })

    it('should extract Head correctly', () => {
      type TestArray = [string, number, boolean]
      type FirstType = Head<TestArray>
      
      // This is a compile-time check
      const head: FirstType = 'hello'
      expect(typeof head).toBe('string')
    })

    it('should extract Tail correctly', () => {
      type TestArray = [string, number, boolean]
      type RestType = Tail<TestArray>
      
      // This is a compile-time check
      const tail: RestType = [42, true]
      expect(tail.length).toBe(2)
    })
  })

  describe('Key extraction types', () => {
    it('should extract string keys', () => {
      interface Mixed {
        stringKey: string
        numberKey: number
        0: string
        1: number
      }
      
      type StringKeysOnly = StringKeys<Mixed>
      
      // This is a compile-time test
      const stringKey: StringKeysOnly = 'stringKey'
      expect(stringKey).toBe('stringKey')
    })

    it('should extract number keys', () => {
      interface Mixed {
        stringKey: string
        numberKey: number
        0: string
        1: number
      }
      
      type NumberKeysOnly = NumberKeys<Mixed>
      
      // This is a compile-time test
      const numberKey: NumberKeysOnly = 0
      expect(numberKey).toBe(0)
    })
  })

  describe('Brand types', () => {
    it('should work with ID brand type', () => {
      type UserId = ID<'User'>
      
      // This would normally require proper branding, but for testing we'll simulate
      const userId = 'user-123' as UserId
      
      expect(typeof userId).toBe('string')
      expect(userId).toBe('user-123')
    })
  })

  describe('Result type', () => {
    it('should create successful results', () => {
      const result = Result.success('hello')
      
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right).toBe('hello')
      }
    })

    it('should create failure results', () => {
      const result = Result.failure('error')
      
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBe('error')
      }
    })

    it('should convert from Either', () => {
      const either = Either.right('success')
      const result = Result.fromEither(either)
      
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right).toBe('success')
      }
    })

    it('should convert to Either', () => {
      const result = Result.success('hello')
      const either = Result.toEither(result)
      
      expect(Either.isRight(either)).toBe(true)
      if (Either.isRight(either)) {
        expect(either.right).toBe('hello')
      }
    })
  })
})