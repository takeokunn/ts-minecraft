/**
 * Unit tests for validation utilities
 * Tests Effect-TS Schema-based validation implementation
 */

import { describe, it, expect } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Either from 'effect/Either'
import * as Schema from '@effect/schema/Schema'
import { 
  Validators,
  ValidationError,
  GameValidators,
  createComponentValidator,
  type ValidationContext 
} from '@shared/utils/validation'

describe('Validation Utilities', () => {
  describe('ValidationError', () => {
    it('should create ValidationError with correct tag', () => {
      const error = ValidationError({
        message: 'Test validation error',
        field: 'testField',
        component: 'TestComponent'
      })

      expect(error._tag).toBe('ValidationError')
      expect(error.message).toBe('Test validation error')
      expect(error.field).toBe('testField')
      expect(error.component).toBe('TestComponent')
    })
  })

  describe('Validators.isNumber', () => {
    it('should validate valid numbers', async () => {
      const result = await Effect.runPromise(Validators.isNumber(42))
      expect(result).toBe(42)
    })

    it('should fail for non-numbers', async () => {
      const result = await Effect.runPromiseExit(Validators.isNumber('not a number'))
      expect(Effect.isFailure(result)).toBe(true)
      
      if (Effect.isFailure(result)) {
        expect(result.cause._tag).toBe('Fail')
        expect(result.cause.error._tag).toBe('ValidationError')
      }
    })

    it('should handle context information', async () => {
      const context: ValidationContext = {
        field: 'age',
        component: 'UserForm',
        operation: 'create'
      }

      const result = await Effect.runPromiseExit(Validators.isNumber('invalid', context))
      expect(Effect.isFailure(result)).toBe(true)

      if (Effect.isFailure(result)) {
        const error = result.cause.error as ValidationError
        expect(error.field).toBe('age')
        expect(error.component).toBe('UserForm')
        expect(error.operation).toBe('create')
      }
    })
  })

  describe('Validators.isString', () => {
    it('should validate valid strings', async () => {
      const result = await Effect.runPromise(Validators.isString('hello'))
      expect(result).toBe('hello')
    })

    it('should fail for non-strings', async () => {
      const result = await Effect.runPromiseExit(Validators.isString(123))
      expect(Effect.isFailure(result)).toBe(true)
    })
  })

  describe('Validators.isPositive', () => {
    it('should validate positive numbers', async () => {
      const result = await Effect.runPromise(Validators.isPositive(5))
      expect(result).toBe(5)
    })

    it('should fail for zero', async () => {
      const result = await Effect.runPromiseExit(Validators.isPositive(0))
      expect(Effect.isFailure(result)).toBe(true)
    })

    it('should fail for negative numbers', async () => {
      const result = await Effect.runPromiseExit(Validators.isPositive(-1))
      expect(Effect.isFailure(result)).toBe(true)
    })
  })

  describe('Validators.inRange', () => {
    it('should validate numbers within range', async () => {
      const validator = Validators.inRange(0, 100)
      const result = await Effect.runPromise(validator(50))
      expect(result).toBe(50)
    })

    it('should fail for numbers outside range', async () => {
      const validator = Validators.inRange(0, 100)
      const result = await Effect.runPromiseExit(validator(150))
      expect(Effect.isFailure(result)).toBe(true)
    })
  })

  describe('Validators.minLength', () => {
    it('should validate strings with sufficient length', async () => {
      const validator = Validators.minLength(5)
      const result = await Effect.runPromise(validator('hello world'))
      expect(result).toBe('hello world')
    })

    it('should fail for strings that are too short', async () => {
      const validator = Validators.minLength(10)
      const result = await Effect.runPromiseExit(validator('short'))
      expect(Effect.isFailure(result)).toBe(true)
    })
  })

  describe('GameValidators', () => {
    describe('position', () => {
      it('should validate valid position objects', async () => {
        const position = { x: 1, y: 2, z: 3 }
        const result = await Effect.runPromise(GameValidators.position(position))
        expect(result).toEqual(position)
      })

      it('should fail for invalid position objects', async () => {
        const invalidPosition = { x: 'not a number', y: 2, z: 3 }
        const result = await Effect.runPromiseExit(GameValidators.position(invalidPosition))
        expect(Effect.isFailure(result)).toBe(true)
      })

      it('should fail for missing properties', async () => {
        const incompletePosition = { x: 1, y: 2 } // missing z
        const result = await Effect.runPromiseExit(GameValidators.position(incompletePosition))
        expect(Effect.isFailure(result)).toBe(true)
      })
    })

    describe('entityId', () => {
      it('should validate non-empty strings', async () => {
        const result = await Effect.runPromise(GameValidators.entityId('player-123'))
        expect(result).toBe('player-123')
      })

      it('should fail for empty strings', async () => {
        const result = await Effect.runPromiseExit(GameValidators.entityId(''))
        expect(Effect.isFailure(result)).toBe(true)
      })

      it('should fail for non-strings', async () => {
        const result = await Effect.runPromiseExit(GameValidators.entityId(123))
        expect(Effect.isFailure(result)).toBe(true)
      })
    })

    describe('chunkCoordinate', () => {
      it('should validate valid chunk coordinates', async () => {
        const coord = { x: 10, z: -5 }
        const result = await Effect.runPromise(GameValidators.chunkCoordinate(coord))
        expect(result).toEqual(coord)
      })

      it('should fail for non-integer coordinates', async () => {
        const invalidCoord = { x: 1.5, z: 2 }
        const result = await Effect.runPromiseExit(GameValidators.chunkCoordinate(invalidCoord))
        expect(Effect.isFailure(result)).toBe(true)
      })
    })
  })

  describe('createComponentValidator', () => {
    it('should create component-specific validator with context', async () => {
      const playerValidator = createComponentValidator('Player')
      
      const validationChain = playerValidator.validate(42, 'health', 'update')
        .with(Validators.isPositive)
        .with(Validators.inRange(0, 100))

      const result = await Effect.runPromise(validationChain.validate())
      expect(result).toBe(42)
    })

    it('should include component context in errors', async () => {
      const playerValidator = createComponentValidator('Player')
      
      const validationChain = playerValidator.validate('invalid', 'health', 'update')
        .with(Validators.isNumber)

      const result = await Effect.runPromiseExit(validationChain.validate())
      expect(Effect.isFailure(result)).toBe(true)

      if (Effect.isFailure(result)) {
        const error = result.cause.error as ValidationError
        expect(error.component).toBe('Player')
        expect(error.field).toBe('health')
        expect(error.operation).toBe('update')
      }
    })
  })

  describe('Schema integration', () => {
    it('should work with custom schemas', async () => {
      const CustomSchema = Schema.Struct({
        name: Schema.String,
        age: Schema.Number.pipe(Schema.positive()),
        tags: Schema.Array(Schema.String)
      })

      const validator = Validators.custom(CustomSchema, 'Invalid user data')
      
      const validData = {
        name: 'John',
        age: 25,
        tags: ['player', 'active']
      }

      const result = await Effect.runPromise(validator(validData))
      expect(result).toEqual(validData)
    })

    it('should fail with custom error message', async () => {
      const CustomSchema = Schema.Struct({
        value: Schema.Number.pipe(Schema.positive())
      })

      const validator = Validators.custom(CustomSchema, 'Custom error message')
      
      const result = await Effect.runPromiseExit(validator({ value: -1 }))
      expect(Effect.isFailure(result)).toBe(true)

      if (Effect.isFailure(result)) {
        const error = result.cause.error as ValidationError
        expect(error.message).toContain('Custom error message')
      }
    })
  })
})