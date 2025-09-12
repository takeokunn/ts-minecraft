/**
 * Integration tests for enhanced schema validation implementations
 * 
 * This test suite verifies that all @effect/schema validation improvements
 * work correctly across the different modules.
 */

import { describe, it, expect } from 'vitest'
import * as Effect from 'effect/Effect'
import * as S from '@effect/schema/Schema'

// Import enhanced validation utilities
import { Logger } from '@shared/utils/logging'
import { ErrorValidation, withErrorHandling } from '@shared/utils/error-handling'
import { 
  withValidation, 
  createValidationError, 
  ValidationErrorValidation,
  createSchemaValidationError,
  createUnknownTypeError
} from '@domain/errors/validation-errors'
import { ComponentErrorValidation } from '@domain/errors/component-errors'

describe('Enhanced Schema Validation Integration', () => {
  
  describe('Logger Schema Validation', () => {
    it('should validate log contexts with unknown values', async () => {
      const testCases = [
        { input: null, expected: {} },
        { input: undefined, expected: {} },
        { input: 'string value', expected: { value: 'string value', type: 'string', raw: 'string value' } },
        { input: { key: 'value' }, expected: { key: 'value' } },
        { input: 42, expected: { value: 42, type: 'number', raw: '42' } }
      ]

      for (const testCase of testCases) {
        const result = await Effect.runPromise(Logger.validateContext(testCase.input))
        expect(result).toEqual(testCase.expected)
      }
    })

    it('should validate error objects with various formats', async () => {
      const testCases = [
        new Error('Test error'),
        'String error',
        { _tag: 'CustomError', message: 'Custom error message' },
        { _tag: 'TaggedError' },
        null,
        42
      ]

      for (const testCase of testCases) {
        const result = await Effect.runPromise(Logger.validateError(testCase))
        expect(result).toBeInstanceOf(Error)
        expect(result.message).toBeDefined()
      }
    })

    it('should validate state objects safely', async () => {
      const testCases = [
        { position: { x: 1, y: 2, z: 3 } },
        'simple string',
        [1, 2, 3],
        null,
        undefined,
        42
      ]

      for (const testCase of testCases) {
        const result = await Effect.runPromise(Logger.validateState(testCase))
        expect(result).toHaveProperty('state')
        expect(result.state).toBeDefined()
      }
    })
  })

  describe('Error Handling Schema Validation', () => {
    it('should validate error handling context', async () => {
      const validContext = {
        component: 'TestComponent',
        operation: 'testOperation',
        metadata: { key: 'value' }
      }

      const result = await Effect.runPromise(ErrorValidation.validateErrorHandlingContext(validContext))
      expect(result.component).toBe('TestComponent')
      expect(result.operation).toBe('testOperation')
      expect(result.metadata).toEqual({ key: 'value' })
    })

    it('should handle invalid error contexts gracefully', async () => {
      const invalidContexts = [null, undefined, 'string', 42, [1, 2, 3]]

      for (const context of invalidContexts) {
        const result = await Effect.runPromise(ErrorValidation.validateErrorHandlingContext(context))
        expect(result).toBeDefined()
        // Should provide sensible defaults or wrap the value
      }
    })

    it('should validate retry configuration', async () => {
      const validConfig = {
        maxAttempts: 5,
        delay: 200,
        backoffMultiplier: 1.5
      }

      const result = await Effect.runPromise(ErrorValidation.validateRetryConfig(validConfig))
      expect(result.maxAttempts).toBe(5)
      expect(result.delay).toBe(200)
      expect(result.backoffMultiplier).toBe(1.5)
    })
  })

  describe('Validation Errors Module', () => {
    it('should create schema validation errors properly', async () => {
      const TestSchema = S.Struct({
        name: S.String,
        age: S.Number
      })

      const invalidData = { name: 123, age: 'invalid' }
      
      const result = await Effect.runPromise(
        createSchemaValidationError(
          'TestSchema',
          invalidData,
          [{ path: ['name'], message: 'Expected string', actual: 123 }],
          'Schema parsing failed'
        )
      )

      expect(result._tag).toBe('SchemaValidationError')
      expect(result.schemaName).toBe('TestSchema')
      expect(result.inputValue).toEqual(invalidData)
    })

    it('should create unknown type errors with suggestions', async () => {
      const unknownValue = { unexpected: 'data' }
      
      const result = await Effect.runPromise(
        createUnknownTypeError(
          unknownValue,
          'PlayerComponent',
          'component validation',
          ['Use type guard', 'Provide fallback']
        )
      )

      expect(result._tag).toBe('UnknownTypeError')
      expect(result.expectedType).toBe('PlayerComponent')
      expect(result.context).toBe('component validation')
      expect(result.suggestions).toContain('Use type guard')
    })

    it('should validate with schema and provide fallbacks', async () => {
      const TestSchema = S.Struct({ value: S.Number })
      const validData = { value: 42 }
      const invalidData = { value: 'not a number' }

      // Test valid data
      const validResult = await Effect.runPromise(
        withValidation.validateWithFallback(TestSchema, { value: 0 })(validData)
      )
      expect(validResult.value).toBe(42)

      // Test invalid data with fallback
      const fallbackResult = await Effect.runPromise(
        withValidation.validateWithFallback(TestSchema, { value: 0 })(invalidData)
      )
      expect(fallbackResult.value).toBe(0)
    })

    it('should validate arrays with partial success', async () => {
      const NumberSchema = S.Number
      const mixedData = [1, 'invalid', 3, null, 5]

      const result = await Effect.runPromise(
        withValidation.validateArrayPartial(NumberSchema)(mixedData)
      )

      expect(result.valid).toEqual([1, 3, 5])
      expect(result.invalid).toHaveLength(2)
      expect(result.invalid[0].input).toBe('invalid')
    })
  })

  describe('Component Errors Schema Validation', () => {
    it('should validate component data with enhanced information', async () => {
      const testComponents = [
        { _tag: 'PositionComponent', data: { x: 1, y: 2, z: 3 } },
        { name: 'TestComponent', value: 42 },
        'simple string',
        null,
        undefined
      ]

      for (const component of testComponents) {
        const result = await Effect.runPromise(ComponentErrorValidation.validateComponentData(component))
        expect(result).toHaveProperty('data')
        expect(result).toHaveProperty('type')
        expect(result).toHaveProperty('isValid')
      }
    })

    it('should validate raw data with serializability checks', async () => {
      const testData = [
        'string data',
        [1, 2, 3],
        { key: 'value' },
        { circular: {} } // Will be modified to create circular reference
      ]

      // Create circular reference
      testData[3].circular = testData[3]

      for (const data of testData) {
        const result = await Effect.runPromise(ComponentErrorValidation.validateRawData(data))
        expect(result).toHaveProperty('rawData')
        expect(result).toHaveProperty('type')
        expect(result).toHaveProperty('isSerializable')
        expect(typeof result.isSerializable).toBe('boolean')
      }
    })
  })

  describe('Integration with Effect-TS Patterns', () => {
    it('should work with complex Effect pipelines', async () => {
      const processUnknownData = (data: unknown) =>
        Effect.gen(function* () {
          // Validate the data
          const validated = yield* Logger.validateContext(data)
          
          // Log the validation result
          yield* Logger.debug('Data validated', 'TestModule', validated, ['test'])
          
          // Handle potential errors
          const errorHandler = withErrorHandling('TestModule')
          
          const processed = yield* errorHandler.handle(
            Effect.succeed(validated),
            'log',
            { fallback: 'processed' }
          )

          return processed
        })

      const testData = { test: 'value', nested: { key: 42 } }
      const result = await Effect.runPromise(processUnknownData(testData))
      
      expect(result).toEqual(testData)
    })

    it('should handle schema validation errors in complex scenarios', async () => {
      const ComplexSchema = S.Struct({
        user: S.Struct({
          id: S.String,
          profile: S.Struct({
            name: S.String,
            settings: S.Record(S.String, S.Unknown)
          })
        }),
        metadata: S.Record(S.String, S.Unknown)
      })

      const invalidComplexData = {
        user: {
          id: 123, // Should be string
          profile: {
            name: 'John',
            settings: { theme: 'dark' }
          }
        },
        metadata: { version: 1 }
      }

      const validationEffect = withValidation.safeSchemaDecodeWithDetails(ComplexSchema)(invalidComplexData)
      
      // This should fail validation but not crash
      const result = await Effect.runPromise(
        Effect.either(validationEffect)
      )

      expect(Effect.isLeft(result)).toBe(true)
      if (Effect.isLeft(result)) {
        expect(result.left._tag).toBe('SchemaValidationError')
      }
    })
  })

  describe('Performance and Memory Considerations', () => {
    it('should handle large datasets efficiently', async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: `item-${i}`,
        nested: { value: i * 2 }
      }))

      const startTime = performance.now()
      
      const result = await Effect.runPromise(
        Logger.validateContext({ largeDataset: largeArray })
      )
      
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(result).toHaveProperty('largeDataset')
      expect(duration).toBeLessThan(100) // Should complete in reasonable time
    })

    it('should handle deeply nested objects safely', async () => {
      const createDeepObject = (depth: number): any => {
        if (depth === 0) return { value: 'leaf' }
        return { nested: createDeepObject(depth - 1), level: depth }
      }

      const deepObject = createDeepObject(10)
      
      // Should not crash with deep nesting
      const result = await Effect.runPromise(
        Logger.validateState(deepObject)
      )

      expect(result).toHaveProperty('state')
      expect(result.state).toBeDefined()
    })
  })
})

describe('Schema Validation Error Reporting', () => {
  it('should provide detailed error reports for validation failures', async () => {
    const UserSchema = S.Struct({
      name: S.String,
      email: S.String,
      age: S.Number
    })

    const invalidUser = {
      name: 123,
      email: null,
      age: 'twenty-five'
    }

    const validationResult = await Effect.runPromise(
      Effect.either(withValidation.safeSchemaDecodeWithDetails(UserSchema)(invalidUser))
    )

    if (Effect.isLeft(validationResult)) {
      const error = validationResult.left
      expect(error.schemaName).toContain('Struct')
      expect(error.inputValue).toEqual(invalidUser)
      expect(error.validationErrors).toBeArray()
      expect(error.validationErrors.length).toBeGreaterThan(0)
    }
  })

  it('should create comprehensive validation helper errors', async () => {
    const apiResponse = {
      unexpected: 'structure',
      missing: 'required fields'
    }

    const error = await Effect.runPromise(
      createValidationError.createApiValidationError(
        '/api/users',
        apiResponse,
        'User[]'
      )
    )

    expect(error._tag).toBe('ExternalDataValidationError')
    expect(error.source).toBe('api')
    expect(error.dataType).toBe('api-response')
    expect(error.rawData).toEqual(apiResponse)
    expect(error.validationErrors).toContain('Invalid response structure from /api/users')
  })
})