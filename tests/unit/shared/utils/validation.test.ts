import { describe, it, expect } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Either from 'effect/Either'
import * as Exit from 'effect/Exit'
import * as V from '@shared/utils/validation'

describe('validation utilities', () => {
  describe('basic validators', () => {
    describe('isNumber', () => {
      it('should validate valid numbers', async () => {
        const result = await Effect.runPromise(V.Validators.isNumber(42))
        expect(result).toBe(42)
      })

      it('should reject invalid numbers', async () => {
        const exit = await Effect.runPromiseExit(V.Validators.isNumber('not a number'))
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('isString', () => {
      it('should validate valid strings', async () => {
        const result = await Effect.runPromise(V.Validators.isString('hello'))
        expect(result).toBe('hello')
      })

      it('should reject invalid strings', async () => {
        const exit = await Effect.runPromiseExit(V.Validators.isString(123))
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('isBoolean', () => {
      it('should validate valid booleans', async () => {
        const resultTrue = await Effect.runPromise(V.Validators.isBoolean(true))
        const resultFalse = await Effect.runPromise(V.Validators.isBoolean(false))
        
        expect(resultTrue).toBe(true)
        expect(resultFalse).toBe(false)
      })

      it('should reject invalid booleans', async () => {
        const exit = await Effect.runPromiseExit(V.Validators.isBoolean('true'))
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })
  })

  describe('numeric validators', () => {
    describe('isPositive', () => {
      it('should validate positive numbers', async () => {
        const result = await Effect.runPromise(V.Validators.isPositive(5))
        expect(result).toBe(5)
      })

      it('should reject zero and negative numbers', async () => {
        const exitZero = await Effect.runPromiseExit(V.Validators.isPositive(0))
        const exitNegative = await Effect.runPromiseExit(V.Validators.isPositive(-5))
        
        expect(Exit.isFailure(exitZero)).toBe(true)
        expect(Exit.isFailure(exitNegative)).toBe(true)
      })
    })

    describe('isNonNegative', () => {
      it('should validate non-negative numbers', async () => {
        const resultZero = await Effect.runPromise(V.Validators.isNonNegative(0))
        const resultPositive = await Effect.runPromise(V.Validators.isNonNegative(5))
        
        expect(resultZero).toBe(0)
        expect(resultPositive).toBe(5)
      })

      it('should reject negative numbers', async () => {
        const exit = await Effect.runPromiseExit(V.Validators.isNonNegative(-1))
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('isInteger', () => {
      it('should validate integers', async () => {
        const result = await Effect.runPromise(V.Validators.isInteger(42))
        expect(result).toBe(42)
      })

      it('should reject non-integers', async () => {
        const exit = await Effect.runPromiseExit(V.Validators.isInteger(3.14))
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('inRange', () => {
      it('should validate numbers in range', async () => {
        const validator = V.Validators.inRange(1, 10)
        const result = await Effect.runPromise(validator(5))
        expect(result).toBe(5)
      })

      it('should reject numbers outside range', async () => {
        const validator = V.Validators.inRange(1, 10)
        const exitLow = await Effect.runPromiseExit(validator(0))
        const exitHigh = await Effect.runPromiseExit(validator(11))
        
        expect(Exit.isFailure(exitLow)).toBe(true)
        expect(Exit.isFailure(exitHigh)).toBe(true)
      })
    })
  })

  describe('string validators', () => {
    describe('minLength', () => {
      it('should validate strings with sufficient length', async () => {
        const validator = V.Validators.minLength(3)
        const result = await Effect.runPromise(validator('hello'))
        expect(result).toBe('hello')
      })

      it('should reject strings that are too short', async () => {
        const validator = V.Validators.minLength(5)
        const exit = await Effect.runPromiseExit(validator('hi'))
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('maxLength', () => {
      it('should validate strings within length limit', async () => {
        const validator = V.Validators.maxLength(10)
        const result = await Effect.runPromise(validator('hello'))
        expect(result).toBe('hello')
      })

      it('should reject strings that are too long', async () => {
        const validator = V.Validators.maxLength(3)
        const exit = await Effect.runPromiseExit(validator('hello'))
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('matches', () => {
      it('should validate strings matching pattern', async () => {
        const validator = V.Validators.matches(/^[a-z]+$/, 'lowercase letters')
        const result = await Effect.runPromise(validator('hello'))
        expect(result).toBe('hello')
      })

      it('should reject strings not matching pattern', async () => {
        const validator = V.Validators.matches(/^[a-z]+$/, 'lowercase letters')
        const exit = await Effect.runPromiseExit(validator('Hello123'))
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })
  })

  describe('ValidationChain', () => {
    it('should create and execute validation chain', async () => {
      const chain = V.ValidationChain.create(5)
      const validatedChain = V.ValidationChain.with(
        chain,
        V.Validators.isPositive,
        V.Validators.inRange(1, 10)
      )

      const result = await Effect.runPromise(V.ValidationChain.validate(validatedChain))
      expect(result).toBe(5)
    })

    it('should fail on first validation error', async () => {
      const chain = V.ValidationChain.create(-5)
      const validatedChain = V.ValidationChain.with(
        chain,
        V.Validators.isPositive,
        V.Validators.inRange(1, 10)
      )

      const exit = await Effect.runPromiseExit(V.ValidationChain.validate(validatedChain))
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('should provide detailed validation results', async () => {
      const chain = V.ValidationChain.create('hello')
      const stringChain = V.ValidationChain.with(
        chain,
        V.Validators.minLength(3),
        V.Validators.maxLength(10)
      )

      const detailed = await Effect.runPromise(V.ValidationChain.validateDetailed(stringChain))
      
      expect(detailed.value).toBe('hello')
      expect(detailed.passed.length).toBe(2)
      expect(detailed.failed.length).toBe(0)
    })

    it('should collect both passed and failed validations', async () => {
      const chain = V.ValidationChain.create('hi')
      const stringChain = V.ValidationChain.with(
        chain,
        V.Validators.minLength(5), // This should fail
        V.Validators.maxLength(10)  // This should pass
      )

      const detailed = await Effect.runPromise(V.ValidationChain.validateDetailed(stringChain))
      
      expect(detailed.value).toBe('hi')
      expect(detailed.passed.length).toBe(1)
      expect(detailed.failed.length).toBe(1)
    })
  })

  describe('ValidationUtils', () => {
    describe('validateObject', () => {
      it('should validate object properties', async () => {
        const obj = { name: 'John', age: 30 }
        const validators = {
          name: V.Validators.minLength(2),
          age: V.Validators.isPositive
        }

        const result = await Effect.runPromise(
          V.ValidationUtils.validateObject(obj, validators)
        )
        
        expect(result).toEqual({ name: 'John', age: 30 })
      })

      it('should fail if any property validation fails', async () => {
        const obj = { name: 'J', age: -5 }
        const validators = {
          name: V.Validators.minLength(2),
          age: V.Validators.isPositive
        }

        const exit = await Effect.runPromiseExit(
          V.ValidationUtils.validateObject(obj, validators)
        )
        
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('validateArray', () => {
      it('should validate all array elements', async () => {
        const array = [1, 2, 3, 4, 5]
        
        const result = await Effect.runPromise(
          V.ValidationUtils.validateArray(array, V.Validators.isPositive)
        )
        
        expect(result).toEqual([1, 2, 3, 4, 5])
      })

      it('should fail if any element validation fails', async () => {
        const array = [1, -2, 3]
        
        const exit = await Effect.runPromiseExit(
          V.ValidationUtils.validateArray(array, V.Validators.isPositive)
        )
        
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('when', () => {
      it('should apply validator when condition is true', async () => {
        const validator = V.ValidationUtils.when(
          (x: number) => x > 0,
          V.Validators.inRange(1, 10)
        )

        const result = await Effect.runPromise(validator(5))
        expect(result).toBe(5)
      })

      it('should skip validator when condition is false', async () => {
        const validator = V.ValidationUtils.when(
          (x: number) => x > 0,
          V.Validators.inRange(1, 10)
        )

        const result = await Effect.runPromise(validator(-5))
        expect(result).toBe(-5) // Should pass through unchanged
      })
    })
  })

  describe('GameValidators', () => {
    describe('position', () => {
      it('should validate valid position objects', async () => {
        const position = { x: 1, y: 2, z: 3 }
        const result = await Effect.runPromise(V.GameValidators.position(position))
        
        expect(result).toEqual(position)
      })

      it('should reject invalid position objects', async () => {
        const invalidPosition = { x: 'not a number', y: 2, z: 3 }
        const exit = await Effect.runPromiseExit(V.GameValidators.position(invalidPosition))
        
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('vector3', () => {
      it('should validate valid vector3 objects', async () => {
        const vector = { x: 1.5, y: -2.3, z: 0 }
        const result = await Effect.runPromise(V.GameValidators.vector3(vector))
        
        expect(result).toEqual(vector)
      })

      it('should reject invalid vector3 objects', async () => {
        const invalidVector = { x: 1, y: 2 } // missing z
        const exit = await Effect.runPromiseExit(V.GameValidators.vector3(invalidVector))
        
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('entityId', () => {
      it('should validate valid entity IDs', async () => {
        const id = 'entity-123'
        const result = await Effect.runPromise(V.GameValidators.entityId(id))
        
        // Should return the branded string
        expect(result).toBe(id)
      })

      it('should reject empty entity IDs', async () => {
        const exit = await Effect.runPromiseExit(V.GameValidators.entityId(''))
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('chunkCoordinate', () => {
      it('should validate valid chunk coordinates', async () => {
        const coord = { x: -5, z: 10 }
        const result = await Effect.runPromise(V.GameValidators.chunkCoordinate(coord))
        
        expect(result).toEqual(coord)
      })

      it('should reject non-integer coordinates', async () => {
        const invalidCoord = { x: 1.5, z: 2 }
        const exit = await Effect.runPromiseExit(V.GameValidators.chunkCoordinate(invalidCoord))
        
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })
  })

  describe('createComponentValidator', () => {
    it('should create component-specific validator', async () => {
      const validator = V.createComponentValidator('TestComponent')
      const chain = validator.validate(42, 'testField', 'testOperation')
      
      const validatedChain = V.ValidationChain.with(chain, V.Validators.isPositive)
      const result = await Effect.runPromise(V.ValidationChain.validate(validatedChain))
      
      expect(result).toBe(42)
    })

    it('should provide access to all validation utilities', () => {
      const validator = V.createComponentValidator('TestComponent')
      
      expect(validator.validators).toBe(V.Validators)
      expect(validator.utils).toBe(V.ValidationUtils)
      expect(validator.game).toBe(V.GameValidators)
    })
  })

  describe('comprehensive coverage tests', () => {
    describe('ValidationError', () => {
      it('should create validation error with all properties', () => {
        const error = V.ValidationError({
          message: 'test error',
          field: 'testField',
          value: 42,
          component: 'TestComponent',
          operation: 'testOperation',
          metadata: { key: 'value' },
          cause: new Error('cause')
        })

        expect(error._tag).toBe('ValidationError')
        expect(error.message).toBe('test error')
        expect(error.field).toBe('testField')
        expect(error.component).toBe('TestComponent')
      })
    })

    describe('array validators with schemas', () => {
      it('should validate arrays with element schemas', async () => {
        const validator = V.Validators.isArray(V.Validators.number)
        const result = await Effect.runPromise(validator([1, 2, 3]))
        expect(result).toEqual([1, 2, 3])
      })

      it('should reject invalid array elements', async () => {
        const validator = V.Validators.isArray(V.Validators.number)
        const exit = await Effect.runPromiseExit(validator([1, 'invalid', 3]))
        expect(Exit.isFailure(exit)).toBe(true)
      })

      it('should validate minItems constraint', async () => {
        const validator = V.Validators.minItems(2, V.Validators.number)
        const result = await Effect.runPromise(validator([1, 2, 3]))
        expect(result).toEqual([1, 2, 3])
      })

      it('should reject arrays with insufficient items', async () => {
        const validator = V.Validators.minItems(3, V.Validators.number)
        const exit = await Effect.runPromiseExit(validator([1]))
        expect(Exit.isFailure(exit)).toBe(true)
      })

      it('should validate maxItems constraint', async () => {
        const validator = V.Validators.maxItems(3, V.Validators.number)
        const result = await Effect.runPromise(validator([1, 2]))
        expect(result).toEqual([1, 2])
      })

      it('should reject arrays with too many items', async () => {
        const validator = V.Validators.maxItems(2, V.Validators.number)
        const exit = await Effect.runPromiseExit(validator([1, 2, 3, 4]))
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('object validators', () => {
      it('should validate objects with required properties', async () => {
        const schema = V.GameValidators.PositionSchema
        const validator = V.Validators.hasProperty('x', schema)
        const result = await Effect.runPromise(validator({ x: 1, y: 2, z: 3 }))
        expect(result).toEqual({ x: 1, y: 2, z: 3 })
      })

      it('should reject objects missing required properties', async () => {
        const schema = V.GameValidators.PositionSchema
        const validator = V.Validators.hasProperty('w', schema)
        const exit = await Effect.runPromiseExit(validator({ x: 1, y: 2, z: 3 }))
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('custom validators', () => {
      it('should apply custom validation logic', async () => {
        const customSchema = V.Validators.number.pipe(V.Validators.number.annotations({ message: 'must be even' }))
        const validator = V.Validators.custom(customSchema, 'Must be a number')
        const result = await Effect.runPromise(validator(42))
        expect(result).toBe(42)
      })

      it('should reject values failing custom validation', async () => {
        const customSchema = V.Validators.string
        const validator = V.Validators.custom(customSchema, 'Must be a string')
        const exit = await Effect.runPromiseExit(validator(123))
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('ValidationUtils.oneOf', () => {
      it('should succeed if any validator passes', async () => {
        const validator = V.ValidationUtils.oneOf(
          V.Validators.isString,
          V.Validators.isNumber
        )
        const result1 = await Effect.runPromise(validator('hello'))
        const result2 = await Effect.runPromise(validator(42))
        
        expect(result1).toBe('hello')
        expect(result2).toBe(42)
      })

      it('should fail if no validators pass', async () => {
        const validator = V.ValidationUtils.oneOf(
          V.Validators.isString,
          V.Validators.isNumber
        )
        const exit = await Effect.runPromiseExit(validator(true))
        expect(Exit.isFailure(exit)).toBe(true)
      })

      it('should handle empty validator list', async () => {
        const validator = V.ValidationUtils.oneOf()
        const exit = await Effect.runPromiseExit(validator(42))
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('ValidationUtils.debug', () => {
      it('should log validation details and pass through value', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation()
        const validator = V.ValidationUtils.debug('test-debug')
        const result = await Effect.runPromise(validator(42))
        
        expect(result).toBe(42)
        expect(consoleSpy).toHaveBeenCalledWith(
          'Validation debug (test-debug):',
          { value: 42, context: undefined }
        )
        
        consoleSpy.mockRestore()
      })

      it('should work without label', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation()
        const validator = V.ValidationUtils.debug()
        await Effect.runPromise(validator(42))
        
        expect(consoleSpy).toHaveBeenCalledWith(
          'Validation debug :',
          { value: 42, context: undefined }
        )
        
        consoleSpy.mockRestore()
      })
    })

    describe('ValidationUtils.validateSchema', () => {
      it('should validate using schema directly', async () => {
        const result = await Effect.runPromise(
          V.ValidationUtils.validateSchema(V.GameValidators.PositionSchema)({ x: 1, y: 2, z: 3 })
        )
        expect(result).toEqual({ x: 1, y: 2, z: 3 })
      })

      it('should fail schema validation with context', async () => {
        const exit = await Effect.runPromiseExit(
          V.ValidationUtils.validateSchema(V.GameValidators.PositionSchema)(
            'invalid',
            { component: 'TestComponent' }
          )
        )
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('all GameValidators', () => {
      it('should validate positionConstrained', async () => {
        const position = { x: 100, y: 50, z: -100 }
        const result = await Effect.runPromise(V.GameValidators.positionConstrained(position))
        expect(result).toEqual(position)
      })

      it('should reject position outside world bounds', async () => {
        const position = { x: 50000000, y: 50, z: -100 }
        const exit = await Effect.runPromiseExit(V.GameValidators.positionConstrained(position))
        expect(Exit.isFailure(exit)).toBe(true)
      })

      it('should validate entityIdNumber', async () => {
        const result = await Effect.runPromise(V.GameValidators.entityIdNumber(123))
        expect(result).toBe(123)
      })

      it('should validate component', async () => {
        const component = { type: 'TestComponent', data: { value: 42 } }
        const result = await Effect.runPromise(V.GameValidators.component(component))
        expect(result).toEqual(component)
      })

      it('should validate componentWithMetadata', async () => {
        const component = {
          type: 'TestComponent',
          data: { value: 42 },
          metadata: { version: '1.0' }
        }
        const result = await Effect.runPromise(V.GameValidators.componentWithMetadata(component))
        expect(result).toEqual(component)
      })

      it('should validate blockCoordinate', async () => {
        const coord = { x: 10, y: 64, z: -5 }
        const result = await Effect.runPromise(V.GameValidators.blockCoordinate(coord))
        expect(result).toEqual(coord)
      })

      it('should validate dimension', async () => {
        const result1 = await Effect.runPromise(V.GameValidators.dimension('overworld'))
        const result2 = await Effect.runPromise(V.GameValidators.dimension('nether'))
        const result3 = await Effect.runPromise(V.GameValidators.dimension('end'))
        
        expect(result1).toBe('overworld')
        expect(result2).toBe('nether')
        expect(result3).toBe('end')
      })

      it('should reject invalid dimension', async () => {
        const exit = await Effect.runPromiseExit(V.GameValidators.dimension('invalid'))
        expect(Exit.isFailure(exit)).toBe(true)
      })

      it('should validate direction', async () => {
        const directions = ['north', 'south', 'east', 'west', 'up', 'down'] as const
        
        for (const dir of directions) {
          const result = await Effect.runPromise(V.GameValidators.direction(dir))
          expect(result).toBe(dir)
        }
      })

      it('should validate faceDirection', async () => {
        const faces = ['front', 'back', 'right', 'left', 'top', 'bottom'] as const
        
        for (const face of faces) {
          const result = await Effect.runPromise(V.GameValidators.faceDirection(face))
          expect(result).toBe(face)
        }
      })

      it('should validate componentData with custom schema', async () => {
        const customSchema = V.Validators.string
        const validator = V.GameValidators.componentData(customSchema)
        const result = await Effect.runPromise(validator('test-data'))
        expect(result).toBe('test-data')
      })
    })

    describe('ValidationChain edge cases', () => {
      it('should handle empty rule chain', async () => {
        const chain = V.ValidationChain.create(42)
        const result = await Effect.runPromise(V.ValidationChain.validate(chain))
        expect(result).toBe(42)
      })

      it('should add rules with custom names and messages', () => {
        const chain = V.ValidationChain.create(42)
        const withRule = V.ValidationChain.rule(
          chain,
          V.Validators.isPositive,
          'positive-check',
          'Must be positive'
        )
        
        expect(withRule.rules).toHaveLength(1)
        expect(withRule.rules[0].name).toBe('positive-check')
        expect(withRule.rules[0].message).toBe('Must be positive')
      })

      it('should preserve context in validation chain', async () => {
        const context = { component: 'TestComponent', field: 'testField' }
        const chain = V.ValidationChain.create(42, context)
        const detailed = await Effect.runPromise(V.ValidationChain.validateDetailed(chain))
        
        expect(detailed.value).toBe(42)
        expect(detailed.passed).toEqual([])
        expect(detailed.failed).toEqual([])
      })
    })

    describe('ValidationError edge cases', () => {
      it('should handle validation errors with specific cause types', async () => {
        const validator = (value: unknown) => 
          value === 'trigger' 
            ? Effect.fail(V.ValidationError({ 
                message: 'triggered error',
                cause: new Error('specific cause')
              }))
            : Effect.succeed(value)

        const exit = await Effect.runPromiseExit(validator('trigger'))
        expect(Exit.isFailure(exit)).toBe(true)
        
        if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
          const error = exit.cause.error as V.ValidationError
          expect(error.message).toBe('triggered error')
          expect(error.cause).toBeInstanceOf(Error)
        }
      })
    })

    describe('numeric error cases', () => {
      it('should handle isPositive with invalid error value', async () => {
        // This tests the error case where value is passed as metadata
        const exit = await Effect.runPromiseExit(V.Validators.isPositive(-5))
        expect(Exit.isFailure(exit)).toBe(true)
      })

      it('should handle isNonNegative with invalid error value', async () => {
        const exit = await Effect.runPromiseExit(V.Validators.isNonNegative(-1))
        expect(Exit.isFailure(exit)).toBe(true)
      })

      it('should handle isInteger with invalid error value', async () => {
        const exit = await Effect.runPromiseExit(V.Validators.isInteger(3.14))
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })
  })
})