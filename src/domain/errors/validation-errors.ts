/**
 * Comprehensive validation error definitions with @effect/schema integration
 * 
 * This module provides enhanced error handling for validation scenarios,
 * specifically designed to work with @effect/schema for type-safe validation.
 */

import { Schema } from 'effect'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'

// Schema definitions for validation errors
const ValidationErrorDetailSchema = Schema.Struct({
  path: Schema.Array(Schema.Union(Schema.String, Schema.Number)),
  message: Schema.String,
  actual: Schema.optional(Schema.Unknown),
  expected: Schema.optional(Schema.String)
})

const SchemaValidationErrorSchema = Schema.Struct({
  schemaName: Schema.String,
  inputValue: Schema.Unknown,
  validationErrors: Schema.Array(ValidationErrorDetailSchema),
  parseError: Schema.optional(Schema.String)
})

const UnknownValueErrorSchema = Schema.Struct({
  value: Schema.Unknown,
  expectedType: Schema.String,
  actualType: Schema.String,
  context: Schema.optional(Schema.String)
})

// Validation utilities for error data
export const ValidationErrorValidation = {
  validateSchemaError: (error: unknown): Effect.Effect<{
    schemaName: string
    inputValue: unknown
    validationErrors: Array<{
      path: Array<string | number>
      message: string
      actual?: unknown
      expected?: string
    }>
    parseError?: string
  }, never, never> => {
    return pipe(
      Schema.decodeUnknown(SchemaValidationErrorSchema)(error),
      Effect.match({
        onFailure: () => ({
          schemaName: 'Unknown',
          inputValue: error,
          validationErrors: [{
            path: [],
            message: 'Invalid schema error structure',
            actual: error,
            expected: 'SchemaValidationError'
          }]
        }),
        onSuccess: (validated) => validated
      }),
      Effect.succeed
    )
  },

  validateUnknownValue: (value: unknown, expectedType?: string, context?: string): Effect.Effect<{
    value: unknown
    expectedType: string
    actualType: string
    context?: string
  }, never> => {
    const actualType = value === null ? 'null' 
      : value === undefined ? 'undefined'
      : Array.isArray(value) ? 'array'
      : typeof value === 'object' && value !== null && '_tag' in value ? `tagged:${(value as { _tag: string })._tag}`
      : typeof value

    return Effect.succeed({
      value,
      expectedType: expectedType || 'known type',
      actualType,
      context
    })
  },

  validateTypeGuard: (value: unknown, typeGuardName: string, guardResult: boolean): Effect.Effect<{
    value: unknown
    typeGuardName: string
    guardResult: boolean
    valueType: string
    isValid: boolean
  }, never> => {
    return Effect.succeed({
      value,
      typeGuardName,
      guardResult,
      valueType: typeof value,
      isValid: guardResult
    })
  }
}

/**
 * Schema validation failed during parsing
 * Recovery: Use default value or skip processing
 */
export const SchemaValidationError = Schema.TaggedError('SchemaValidationError')({
  message: Schema.String,
  schemaName: Schema.String,
  inputValue: Schema.Unknown,
  validationErrors: Schema.Array(Schema.Struct({
    path: Schema.Array(Schema.Union(Schema.String, Schema.Number)),
    message: Schema.String,
    actual: Schema.optional(Schema.Unknown),
    expected: Schema.optional(Schema.String)
  })),
  parseError: Schema.optional(Schema.String),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export interface SchemaValidationError extends Schema.Schema.Type<typeof SchemaValidationError> {}

// Enhanced constructor with validation
export const createSchemaValidationError = (
  message: string,
  schemaName: string,
  inputValue: unknown,
  validationErrors: Array<{
    path: Array<string | number>
    message: string
    actual?: unknown
    expected?: string
  }>,
  parseError?: string
) => SchemaValidationError({
  message,
  schemaName,
  inputValue,
  validationErrors,
  parseError,
  timestamp: Date.now(),
  context: {}
})

/**
 * Unknown type encountered where specific type was expected
 * Recovery: Use type guards or provide fallback
 */
export const UnknownTypeError = Schema.TaggedError('UnknownTypeError')({
  message: Schema.String,
  value: Schema.Unknown,
  expectedType: Schema.String,
  actualType: Schema.String,
  errorContext: Schema.optional(Schema.String),
  suggestions: Schema.optional(Schema.Array(Schema.String)),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export interface UnknownTypeError extends Schema.Schema.Type<typeof UnknownTypeError> {}

// Enhanced constructor with validation
export const createUnknownTypeError = (
  message: string,
  value: unknown,
  expectedType: string,
  actualType: string,
  errorContext?: string,
  suggestions?: string[]
) => UnknownTypeError({
  message,
  value,
  expectedType,
  actualType,
  errorContext,
  suggestions,
  timestamp: Date.now(),
  context: {}
})

/**
 * Type guard validation failed
 * Recovery: Try alternative type guards or use default
 */
export const TypeGuardError = Schema.TaggedError('TypeGuardError')({
  message: Schema.String,
  value: Schema.Unknown,
  typeGuardName: Schema.String,
  expectedType: Schema.String,
  actualType: Schema.String,
  guardResult: Schema.Boolean,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export interface TypeGuardError extends Schema.Schema.Type<typeof TypeGuardError> {}

// Enhanced constructor with validation
export const createTypeGuardError = (
  message: string,
  value: unknown,
  typeGuardName: string,
  expectedType: string,
  actualType: string,
  guardResult: boolean
) => TypeGuardError({
  message,
  value,
  typeGuardName,
  expectedType,
  actualType,
  guardResult,
  timestamp: Date.now(),
  context: {}
})

/**
 * External data validation failed (API responses, user input, etc.)
 * Recovery: Sanitize data or use fallback values
 */
export const ExternalDataValidationError = Schema.TaggedError('ExternalDataValidationError')({
  message: Schema.String,
  source: Schema.Union(
    Schema.Literal('api'),
    Schema.Literal('user-input'),
    Schema.Literal('file'),
    Schema.Literal('network'),
    Schema.Literal('storage'),
    Schema.Literal('unknown')
  ),
  dataType: Schema.String,
  rawData: Schema.Unknown,
  validationErrors: Schema.Array(Schema.String),
  sanitizedData: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export interface ExternalDataValidationError extends Schema.Schema.Type<typeof ExternalDataValidationError> {}

/**
 * Deserialization failed with schema mismatch
 * Recovery: Use migration or provide compatible defaults
 */
export const DeserializationError = Schema.TaggedError('DeserializationError')({
  message: Schema.String,
  format: Schema.Union(
    Schema.Literal('json'),
    Schema.Literal('binary'),
    Schema.Literal('xml'),
    Schema.Literal('yaml'),
    Schema.Literal('unknown')
  ),
  expectedSchema: Schema.String,
  actualStructure: Schema.Unknown,
  migrationAvailable: Schema.Boolean,
  rawData: Schema.Unknown,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export interface DeserializationError extends Schema.Schema.Type<typeof DeserializationError> {}

/**
 * Runtime type assertion failed
 * Recovery: Use safe type guards instead
 */
export const TypeAssertionError = Schema.TaggedError('TypeAssertionError')({
  message: Schema.String,
  value: Schema.Unknown,
  assertedType: Schema.String,
  actualType: Schema.String,
  stackTrace: Schema.String,
  suggestion: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export interface TypeAssertionError extends Schema.Schema.Type<typeof TypeAssertionError> {}

// Helper functions for common validation scenarios
export const ValidationHelpers = {
  // Create validation error for unknown values with suggestions
  createUnknownValueError: (value: unknown, expectedTypes: string[], errorContext?: string) => {
    const actualType = typeof value
    const suggestion = expectedTypes.length === 1 
      ? `Expected ${expectedTypes[0]}, got ${actualType}`
      : `Expected one of [${expectedTypes.join(', ')}], got ${actualType}`
    
    return createUnknownTypeError(
      suggestion,
      value,
      expectedTypes.join(' | '),
      actualType,
      errorContext,
      [`Use type guard: is${expectedTypes[0]}()`, 'Provide fallback value', 'Check data source']
    )
  },

  // Create validation error for failed schema parsing
  createSchemaParseError: (schemaName: string, input: unknown, parseErrors: unknown[]) => {
    const errorDetails = parseErrors.map((error, index) => ({
      path: [index],
      message: String(error),
      actual: input,
      expected: schemaName
    }))
    
    return createSchemaValidationError(
      `Schema parsing failed for ${schemaName}`,
      schemaName,
      input,
      errorDetails,
      `Schema parsing failed for ${schemaName}`
    )
  },

  // Create validation error for API response mismatches
  createApiValidationError: (endpoint: string, response: unknown, expectedSchema: string) =>
    ExternalDataValidationError({
      message: `Invalid response structure from ${endpoint}`,
      source: 'api' as const,
      dataType: 'api-response',
      rawData: response,
      validationErrors: [`Invalid response structure from ${endpoint}`, `Expected: ${expectedSchema}`, `Actual: ${typeof response}`],
      sanitizedData: undefined,
      timestamp: Date.now(),
      context: {}
    }),

  // Create validation error for user input
  createUserInputError: (fieldName: string, input: unknown, validationRules: string[]) =>
    ExternalDataValidationError({
      message: `User input validation failed for ${fieldName}`,
      source: 'user-input' as const,
      dataType: 'form-data',
      rawData: input,
      validationErrors: validationRules.map(rule => `${fieldName}: ${rule}`),
      sanitizedData: typeof input === 'string' ? input.trim() : undefined,
      timestamp: Date.now(),
      context: {}
    })
}

// Schema validation utilities for external use
export const SchemaValidationUtils = {
  // Safe schema decode with detailed error information
  safeSchemaDecodeWithDetails: <A, I>(schema: Schema.Schema<A, I, never>) => 
    (input: unknown): Effect.Effect<A, Schema.Schema.Type<typeof SchemaValidationError>, never> =>
      pipe(
        Schema.decodeUnknown(schema)(input),
        Effect.mapError((parseError) =>
          SchemaValidationError({
            message: `Schema validation failed: ${String(parseError)}`,
            schemaName: schema.toString(),
            inputValue: input,
            validationErrors: [{
              path: [],
              message: String(parseError),
              actual: input,
              expected: schema.toString()
            }],
            parseError: String(parseError),
            timestamp: Date.now(),
            context: {}
          })
        )
      ),

  // Validate with fallback
  validateWithFallback: <A, I>(schema: Schema.Schema<A, I, never>, fallback: A) =>
    (input: unknown): Effect.Effect<A, never> =>
      pipe(
        Schema.decodeUnknown(schema)(input),
        Effect.orElse(() => Effect.succeed(fallback))
      ),

  // Validate array with partial success
  validateArrayPartial: <A, I>(schema: Schema.Schema<A, I, never>) =>
    (inputs: unknown[]): Effect.Effect<{ valid: A[], invalid: Array<{ input: unknown, error: string }> }, never, never> =>
      Effect.gen(function* () {
        const results = yield* Effect.all(
          inputs.map(input =>
            pipe(
              Schema.decodeUnknown(schema)(input),
              Effect.map(valid => ({ type: 'valid' as const, value: valid })),
              Effect.catchAll(error => 
                Effect.succeed({ type: 'invalid' as const, input, error: String(error) })
              )
            )
          )
        )

        return results.reduce(
          (acc, result) => {
            if (result.type === 'valid') {
              acc.valid.push(result.value)
            } else {
              acc.invalid.push({ input: result.input, error: result.error })
            }
            return acc
          },
          { valid: [] as A[], invalid: [] as Array<{ input: unknown, error: string }> }
        )
      })
}

// Export commonly used patterns
export const withValidation = SchemaValidationUtils
export const createValidationError = ValidationHelpers
export const validateError = ValidationErrorValidation