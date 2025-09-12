/**
 * Centralized validation utilities for ts-minecraft
 *
 * Provides consistent validation patterns across all layers
 * with Effect-TS integration and comprehensive error handling.
 */

import * as Effect from 'effect/Effect'
import * as Schema from '@effect/schema/Schema'
import * as ParseResult from '@effect/schema/ParseResult'
import { pipe } from 'effect/Function'
import { Brand } from 'effect/Brand'
// Note: Using local ValidationError definition to avoid domain layer dependency
import * as Data from 'effect/Data'

export interface ValidationError extends Data.Case {
  readonly _tag: 'ValidationError'
  readonly message: string
  readonly field?: string
  readonly component?: string
  readonly operation?: string
  readonly metadata?: Record<string, unknown>
  readonly cause?: unknown
}

export const ValidationError = Data.tagged<ValidationError>('ValidationError')

// Common validation result types
export type ValidationResult<T> = Effect.Effect<T, ValidationError, never>

// Validation context for better error reporting
export interface ValidationContext {
  field?: string
  component?: string
  operation?: string
  metadata?: Record<string, unknown>
}

// Custom validation function type
export type ValidatorFn<T> = (value: T, context?: ValidationContext) => ValidationResult<T>

// Validation rule interface
export interface ValidationRule<T> {
  name: string
  validate: ValidatorFn<T>
  message?: string
}

// Create a validation error with context
const createValidationError = (message: string, context?: ValidationContext, cause?: unknown): ValidationError =>
  ValidationError({
    message: `Validation failed: ${message}`,
    field: context?.field,
    component: context?.component,
    operation: context?.operation,
    metadata: context?.metadata,
    cause,
  })

// Basic validators
export const Validators = {
  // Schema-based validators
  number: Schema.Number,
  string: Schema.String,
  boolean: Schema.Boolean,
  
  // Primitive type validators using Schema
  isNumber: <I>(value: I, context?: ValidationContext): ValidationResult<number> =>
    pipe(
      Schema.decodeUnknown(Schema.Number)(value),
      Effect.mapError((parseError) => 
        createValidationError(`Expected number, got ${typeof value}`, context, parseError)
      )
    ),

  isString: <I>(value: I, context?: ValidationContext): ValidationResult<string> =>
    pipe(
      Schema.decodeUnknown(Schema.String)(value),
      Effect.mapError((parseError) => 
        createValidationError(`Expected string, got ${typeof value}`, context, parseError)
      )
    ),

  isBoolean: <I>(value: I, context?: ValidationContext): ValidationResult<boolean> =>
    pipe(
      Schema.decodeUnknown(Schema.Boolean)(value),
      Effect.mapError((parseError) => 
        createValidationError(`Expected boolean, got ${typeof value}`, context, parseError)
      )
    ),

  isArray: <T, I>(elementSchema: Schema.Schema<T, I>) => 
    <Input>(value: Input, context?: ValidationContext): ValidationResult<T[]> =>
      pipe(
        Schema.decodeUnknown(Schema.Array(elementSchema))(value),
        Effect.mapError((parseError) => 
          createValidationError(`Expected array, got ${typeof value}`, context, parseError)
        )
      ),

  // Numeric validators
  isPositive: (value: number, context?: ValidationContext): ValidationResult<number> =>
    pipe(
      Schema.decodeUnknown(Schema.Number.pipe(Schema.positive()))(value),
      Effect.mapError(() => createValidationError('Must be positive', context, value))
    ),

  isNonNegative: (value: number, context?: ValidationContext): ValidationResult<number> =>
    pipe(
      Schema.decodeUnknown(Schema.Number.pipe(Schema.nonNegative()))(value),
      Effect.mapError(() => createValidationError('Must be non-negative', context, value))
    ),

  isInteger: (value: number, context?: ValidationContext): ValidationResult<number> =>
    pipe(
      Schema.decodeUnknown(Schema.Number.pipe(Schema.int()))(value),
      Effect.mapError(() => createValidationError('Must be an integer', context, value))
    ),

  inRange: (min: number, max: number) =>
    (value: number, context?: ValidationContext): ValidationResult<number> =>
      pipe(
        Schema.decodeUnknown(Schema.Number.pipe(Schema.between(min, max)))(value),
        Effect.mapError(() => createValidationError(`Must be between ${min} and ${max}`, context, { value, min, max }))
      ),

  // String validators
  minLength: (min: number) =>
    (value: string, context?: ValidationContext): ValidationResult<string> =>
      pipe(
        Schema.decodeUnknown(Schema.String.pipe(Schema.minLength(min)))(value),
        Effect.mapError(() => createValidationError(`Minimum length is ${min}`, context, { value, length: value.length, min }))
      ),

  maxLength: (max: number) =>
    (value: string, context?: ValidationContext): ValidationResult<string> =>
      pipe(
        Schema.decodeUnknown(Schema.String.pipe(Schema.maxLength(max)))(value),
        Effect.mapError(() => createValidationError(`Maximum length is ${max}`, context, { value, length: value.length, max }))
      ),

  matches: (pattern: RegExp, patternName?: string) =>
    (value: string, context?: ValidationContext): ValidationResult<string> =>
      pipe(
        Schema.decodeUnknown(Schema.String.pipe(Schema.pattern(pattern)))(value),
        Effect.mapError(() => createValidationError(`Must match ${patternName || 'pattern'}`, context, { value, pattern: pattern.toString() }))
      ),

  // Array validators  
  minItems: <T>(min: number, elementSchema: Schema.Schema<T>) =>
    <I>(value: I, context?: ValidationContext): ValidationResult<T[]> =>
      pipe(
        Schema.decodeUnknown(Schema.Array(elementSchema).pipe(Schema.minItems(min)))(value),
        Effect.mapError(() => createValidationError(`Minimum ${min} items required`, context, { value, min }))
      ),

  maxItems: <T>(max: number, elementSchema: Schema.Schema<T>) =>
    <I>(value: I, context?: ValidationContext): ValidationResult<T[]> =>
      pipe(
        Schema.decodeUnknown(Schema.Array(elementSchema).pipe(Schema.maxItems(max)))(value),
        Effect.mapError(() => createValidationError(`Maximum ${max} items allowed`, context, { value, max }))
      ),

  // Object validators
  hasProperty: <T extends Record<string, unknown>>(property: keyof T, schema: Schema.Schema<T>) =>
    <I>(value: I, context?: ValidationContext): ValidationResult<T> =>
      pipe(
        Schema.decodeUnknown(schema)(value),
        Effect.flatMap((obj) => 
          property in obj 
            ? Effect.succeed(obj)
            : Effect.fail(createValidationError(`Missing required property: ${String(property)}`, context, { value, property }))
        )
      ),

  // Custom validators with Schema
  custom: <A, I>(schema: Schema.Schema<A, I>, message: string) =>
    (value: I, context?: ValidationContext): ValidationResult<A> =>
      pipe(
        Schema.decodeUnknown(schema)(value),
        Effect.mapError(() => createValidationError(message, context, value))
      ),
}

// Validation chain state
interface ValidationChainState<T> {
  readonly initialValue: T
  readonly context?: ValidationContext
  readonly rules: ReadonlyArray<ValidationRule<T>>
}

// Validation chain builder functions
export const ValidationChain = {
  /**
   * Create a new validation chain
   */
  create: <T>(initialValue: T, context?: ValidationContext): ValidationChainState<T> => ({
    initialValue,
    context,
    rules: [],
  }),

  /**
   * Add a validation rule
   */
  rule: <T>(state: ValidationChainState<T>, validator: ValidatorFn<T>, name?: string, message?: string): ValidationChainState<T> => ({
    ...state,
    rules: [
      ...state.rules,
      {
        name: name || `rule-${state.rules.length}`,
        validate: validator,
        message,
      },
    ],
  }),

  /**
   * Add multiple validators
   */
  with: <T>(state: ValidationChainState<T>, ...validators: ValidatorFn<T>[]): ValidationChainState<T> => ({
    ...state,
    rules: [
      ...state.rules,
      ...validators.map((validator, index) => ({
        name: `validator-${state.rules.length + index}`,
        validate: validator,
      })),
    ],
  }),

  /**
   * Execute all validation rules
   */
  validate: <T>(state: ValidationChainState<T>): ValidationResult<T> =>
    pipe(
      Effect.succeed(state.initialValue),
      Effect.flatMap((value) => {
        return state.rules.reduce(
          (acc, rule) =>
            pipe(
              acc,
              Effect.flatMap((v) => rule.validate(v, state.context)),
            ),
          Effect.succeed(value),
        )
      }),
    ),

  /**
   * Execute validation and return result with rule details
   */
  validateDetailed: <T>(
    state: ValidationChainState<T>,
  ): Effect.Effect<
    {
      value: T
      passed: string[]
      failed: Array<{ rule: string; error: ValidationError }>
    },
    never,
    never
  > => {
    const results = {
      value: state.initialValue,
      passed: [] as string[],
      failed: [] as Array<{ rule: string; error: ValidationError }>,
    }

    return pipe(
      state.rules.reduce(
        (acc, rule) =>
          pipe(
            acc,
            Effect.flatMap((currentValue) =>
              pipe(
                rule.validate(currentValue, state.context),
                Effect.map((validValue) => {
                  results.passed.push(rule.name)
                  return validValue
                }),
                Effect.catchAll((error) => {
                  results.failed.push({ rule: rule.name, error })
                  return Effect.succeed(currentValue) // Continue with current value
                }),
              ),
            ),
          ),
        Effect.succeed(state.initialValue),
      ),
      Effect.map(() => results),
    )
  },
}

// Validation utilities
export const ValidationUtils = {
  // Create a validation chain
  validate: <T>(value: T, context?: ValidationContext) => ValidationChain.create(value, context),

  // Validate using Schema
  validateSchema:
    <I, A>(schema: Schema.Schema<A, I>) =>
    (value: I, context?: ValidationContext): ValidationResult<A> =>
      pipe(
        Schema.decodeUnknown(schema)(value),
        Effect.mapError((parseError) => createValidationError('Schema validation failed', context, parseError)),
      ),

  // Validate object properties
  validateObject: <T extends Record<string, unknown>>(value: T, validators: Partial<{ [K in keyof T]: ValidatorFn<T[K]> }>, context?: ValidationContext): ValidationResult<T> => {
    const entries = Object.entries(validators) as Array<[keyof T, ValidatorFn<T[keyof T]>]>

    return pipe(
      entries.reduce(
        (acc, [key, validator]) =>
          pipe(
            acc,
            Effect.flatMap((obj) =>
              pipe(
                validator(obj[key], { ...context, field: String(key) }),
                Effect.map((validValue) => ({
                  ...obj,
                  [key]: validValue,
                })),
              ),
            ),
          ),
        Effect.succeed(value),
      ),
    )
  },

  // Validate array elements
  validateArray: <T>(array: T[], validator: ValidatorFn<T>, context?: ValidationContext): ValidationResult<T[]> => {
    return pipe(
      array.reduce(
        (acc, item, index) =>
          pipe(
            acc,
            Effect.flatMap((validArray) =>
              pipe(
                validator(item, { ...context, field: `[${index}]` }),
                Effect.map((validItem) => [...validArray, validItem]),
              ),
            ),
          ),
        Effect.succeed([] as T[]),
      ),
    )
  },

  // Conditional validation
  when:
    <T>(condition: (value: T) => boolean, validator: ValidatorFn<T>) =>
    (value: T, context?: ValidationContext): ValidationResult<T> =>
      condition(value) ? validator(value, context) : Effect.succeed(value),

  // Combine multiple validators with OR logic
  oneOf:
    <T>(...validators: ValidatorFn<T>[]) =>
    (value: T, context?: ValidationContext): ValidationResult<T> => {
      const errors: ValidationError[] = []

      for (const validator of validators) {
        const result = validator(value, context)
        if (Effect.isEffect(result)) {
          // Run the effect to get the result
          return pipe(
            result,
            Effect.catchAll((error) => {
              errors.push(error)
              if (errors.length === validators.length) {
                return Effect.fail(createValidationError('None of the validation alternatives succeeded', context, errors))
              }
              return Effect.fail(error) // Continue to next validator
            }),
          )
        }
      }

      return Effect.fail(createValidationError('No validators provided', context))
    },

  // Debug validation
  debug:
    <T>(label?: string) =>
    (value: T, context?: ValidationContext): ValidationResult<T> => {
      console.log(`Validation debug ${label ? `(${label})` : ''}:`, {
        value,
        context,
      })
      return Effect.succeed(value)
    },
}

// Common validation schemas for game entities
export const GameValidators = {
  // Position Schema
  PositionSchema: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),

  // Vector3 Schema
  Vector3Schema: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),

  // Entity ID Schema
  EntityIdSchema: Schema.String.pipe(
    Schema.nonEmpty(),
    Schema.brand('EntityId')
  ),

  // Chunk coordinate Schema
  ChunkCoordinateSchema: Schema.Struct({
    x: Schema.Number.pipe(Schema.int()),
    z: Schema.Number.pipe(Schema.int()),
  }),

  // Position validation
  position: <I>(value: I, context?: ValidationContext): ValidationResult<{ x: number; y: number; z: number }> =>
    pipe(
      Schema.decodeUnknown(GameValidators.PositionSchema)(value),
      Effect.mapError((parseError) => createValidationError('Invalid position', context, parseError))
    ),

  // Vector3 validation  
  vector3: <I>(value: I, context?: ValidationContext): ValidationResult<{ x: number; y: number; z: number }> =>
    pipe(
      Schema.decodeUnknown(GameValidators.Vector3Schema)(value),
      Effect.mapError((parseError) => createValidationError('Invalid vector3', context, parseError))
    ),

  // Entity ID validation
  entityId: <I>(value: I, context?: ValidationContext): ValidationResult<string & Brand<'EntityId'>> =>
    pipe(
      Schema.decodeUnknown(GameValidators.EntityIdSchema)(value),
      Effect.mapError((parseError) => createValidationError('Invalid entity ID', context, parseError))
    ),

  // Chunk coordinate validation
  chunkCoordinate: <I>(value: I, context?: ValidationContext): ValidationResult<{ x: number; z: number }> =>
    pipe(
      Schema.decodeUnknown(GameValidators.ChunkCoordinateSchema)(value),
      Effect.mapError((parseError) => createValidationError('Invalid chunk coordinate', context, parseError))
    ),

  // Component data validation
  componentData: <T>(schema: Schema.Schema<T>) => 
    <I>(value: I, context?: ValidationContext): ValidationResult<T> =>
      pipe(
        Schema.decodeUnknown(schema)(value),
        Effect.mapError((parseError) => createValidationError('Invalid component data', context, parseError))
      ),
}

// Export helper for creating component-specific validators
export const createComponentValidator = (component: string) => ({
  validate: <T>(value: T, field?: string, operation?: string) => ValidationUtils.validate(value, { component, field, operation }),

  validators: Validators,
  utils: ValidationUtils,
  game: GameValidators,
})
