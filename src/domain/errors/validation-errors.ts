/**
 * Comprehensive validation error definitions with @effect/schema integration
 * 
 * This module provides enhanced error handling for validation scenarios,
 * specifically designed to work with @effect/schema for type-safe validation.
 */

import { defineError } from '@domain/errors/generator'
import { DomainError } from '@domain/errors/base-errors'
import * as S from '@effect/schema/Schema'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'

// Schema definitions for validation errors
const ValidationErrorDetailSchema = S.Struct({
  path: S.Array(S.Union(S.String, S.Number)),
  message: S.String,
  actual: S.optional(S.Unknown),
  expected: S.optional(S.String)
})

const SchemaValidationErrorSchema = S.Struct({
  schemaName: S.String,
  inputValue: S.Unknown,
  validationErrors: S.Array(ValidationErrorDetailSchema),
  parseError: S.optional(S.String)
})

const UnknownValueErrorSchema = S.Struct({
  value: S.Unknown,
  expectedType: S.String,
  actualType: S.String,
  context: S.optional(S.String)
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
      S.decodeUnknown(SchemaValidationErrorSchema)(error),
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
  }, never, never> => {
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
  }, never, never> => {
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
export const SchemaValidationError = defineError<{
  readonly schemaName: string
  readonly inputValue: unknown
  readonly validationErrors: ReadonlyArray<{
    readonly path: ReadonlyArray<string | number>
    readonly message: string
    readonly actual?: unknown
    readonly expected?: string
  }>
  readonly parseError?: string
}>('SchemaValidationError', DomainError, 'fallback', 'high')

// Enhanced constructor with validation
export const createSchemaValidationError = (
  schemaName: string,
  inputValue: unknown,
  validationErrors: unknown,
  parseError?: string
) => Effect.gen(function* () {
  const validated = yield* ValidationErrorValidation.validateSchemaError({
    schemaName,
    inputValue,
    validationErrors,
    parseError
  })
  return SchemaValidationError(validated)
})

/**
 * Unknown type encountered where specific type was expected
 * Recovery: Use type guards or provide fallback
 */
export const UnknownTypeError = defineError<{
  readonly value: unknown
  readonly expectedType: string
  readonly actualType: string
  readonly context?: string
  readonly suggestions?: ReadonlyArray<string>
}>('UnknownTypeError', DomainError, 'fallback', 'medium')

// Enhanced constructor with validation
export const createUnknownTypeError = (
  value: unknown,
  expectedType: string,
  context?: string,
  suggestions?: string[]
) => Effect.gen(function* () {
  const validated = yield* ValidationErrorValidation.validateUnknownValue(value, expectedType, context)
  return UnknownTypeError({
    ...validated,
    suggestions: suggestions ? readonly(suggestions) : undefined
  })
})

/**
 * Type guard validation failed
 * Recovery: Try alternative type guards or use default
 */
export const TypeGuardError = defineError<{
  readonly value: unknown
  readonly typeGuardName: string
  readonly expectedType: string
  readonly actualType: string
  readonly guardResult: boolean
}>('TypeGuardError', DomainError, 'fallback', 'medium')

// Enhanced constructor with validation
export const createTypeGuardError = (
  value: unknown,
  typeGuardName: string,
  expectedType: string
) => Effect.gen(function* () {
  const validated = yield* ValidationErrorValidation.validateTypeGuard(value, typeGuardName, false)
  return TypeGuardError({
    ...validated,
    expectedType,
    actualType: validated.valueType
  })
})

/**
 * External data validation failed (API responses, user input, etc.)
 * Recovery: Sanitize data or use fallback values
 */
export const ExternalDataValidationError = defineError<{
  readonly source: 'api' | 'user-input' | 'file' | 'network' | 'storage' | 'unknown'
  readonly dataType: string
  readonly rawData: unknown
  readonly validationErrors: ReadonlyArray<string>
  readonly sanitizedData?: unknown
}>('ExternalDataValidationError', DomainError, 'fallback', 'high')

/**
 * Deserialization failed with schema mismatch
 * Recovery: Use migration or provide compatible defaults
 */
export const DeserializationError = defineError<{
  readonly format: 'json' | 'binary' | 'xml' | 'yaml' | 'unknown'
  readonly expectedSchema: string
  readonly actualStructure: unknown
  readonly migrationAvailable: boolean
  readonly rawData: unknown
}>('DeserializationError', DomainError, 'fallback', 'high')

/**
 * Runtime type assertion failed
 * Recovery: Use safe type guards instead
 */
export const TypeAssertionError = defineError<{
  readonly value: unknown
  readonly assertedType: string
  readonly actualType: string
  readonly stackTrace: string
  readonly suggestion: string
}>('TypeAssertionError', DomainError, 'ignore', 'low')

// Helper functions for common validation scenarios
export const ValidationHelpers = {
  // Create validation error for unknown values with suggestions
  createUnknownValueError: (value: unknown, expectedTypes: string[], context?: string) =>
    Effect.gen(function* () {
      const actualType = typeof value
      const suggestion = expectedTypes.length === 1 
        ? `Expected ${expectedTypes[0]}, got ${actualType}`
        : `Expected one of [${expectedTypes.join(', ')}], got ${actualType}`
      
      return yield* createUnknownTypeError(
        value,
        expectedTypes.join(' | '),
        context,
        [`Use type guard: is${expectedTypes[0]}()`, 'Provide fallback value', 'Check data source']
      )
    }),

  // Create validation error for failed schema parsing
  createSchemaParseError: (schemaName: string, input: unknown, parseErrors: unknown[]) =>
    Effect.gen(function* () {
      const errorDetails = parseErrors.map((error, index) => ({
        path: [index],
        message: String(error),
        actual: input,
        expected: schemaName
      }))
      
      return yield* createSchemaValidationError(
        schemaName,
        input,
        errorDetails,
        `Schema parsing failed for ${schemaName}`
      )
    }),

  // Create validation error for API response mismatches
  createApiValidationError: (endpoint: string, response: unknown, expectedSchema: string) =>
    ExternalDataValidationError({
      source: 'api',
      dataType: 'api-response',
      rawData: response,
      validationErrors: [`Invalid response structure from ${endpoint}`, `Expected: ${expectedSchema}`, `Actual: ${typeof response}`],
      sanitizedData: undefined
    }),

  // Create validation error for user input
  createUserInputError: (fieldName: string, input: unknown, validationRules: string[]) =>
    ExternalDataValidationError({
      source: 'user-input',
      dataType: 'form-data',
      rawData: input,
      validationErrors: validationRules.map(rule => `${fieldName}: ${rule}`),
      sanitizedData: typeof input === 'string' ? input.trim() : undefined
    })
}

// Schema validation utilities for external use
export const SchemaValidationUtils = {
  // Safe schema decode with detailed error information
  safeSchemaDecodeWithDetails: <A, I>(schema: S.Schema<A, I, never>) => 
    (input: unknown): Effect.Effect<A, SchemaValidationError, never> =>
      pipe(
        S.decodeUnknown(schema)(input),
        Effect.mapError((parseError) =>
          SchemaValidationError({
            schemaName: schema.toString(),
            inputValue: input,
            validationErrors: [{
              path: [],
              message: String(parseError),
              actual: input,
              expected: schema.toString()
            }],
            parseError: String(parseError)
          })
        )
      ),

  // Validate with fallback
  validateWithFallback: <A, I>(schema: S.Schema<A, I, never>, fallback: A) =>
    (input: unknown): Effect.Effect<A, never, never> =>
      pipe(
        S.decodeUnknown(schema)(input),
        Effect.orElse(() => Effect.succeed(fallback))
      ),

  // Validate array with partial success
  validateArrayPartial: <A, I>(schema: S.Schema<A, I, never>) =>
    (inputs: unknown[]): Effect.Effect<{ valid: A[], invalid: Array<{ input: unknown, error: string }> }, never, never> =>
      Effect.gen(function* () {
        const results = yield* Effect.all(
          inputs.map(input =>
            pipe(
              S.decodeUnknown(schema)(input),
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