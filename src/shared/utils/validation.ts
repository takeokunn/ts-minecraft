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
import { ValidationError } from '@domain/errors'

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
const createValidationError = (
  message: string,
  context?: ValidationContext,
  cause?: unknown
): ValidationError =>
  new ValidationError({
    message: `Validation failed: ${message}`,
    context: {
      field: context?.field,
      component: context?.component,
      operation: context?.operation,
      metadata: context?.metadata,
      cause,
    },
  })

// Basic validators
export const Validators = {
  // Primitive type validators
  isNumber: (value: unknown, context?: ValidationContext): ValidationResult<number> => {
    if (typeof value !== 'number' || isNaN(value)) {
      return Effect.fail(createValidationError(
        `Expected number, got ${typeof value}`,
        context,
        value
      ))
    }
    return Effect.succeed(value)
  },

  isString: (value: unknown, context?: ValidationContext): ValidationResult<string> => {
    if (typeof value !== 'string') {
      return Effect.fail(createValidationError(
        `Expected string, got ${typeof value}`,
        context,
        value
      ))
    }
    return Effect.succeed(value)
  },

  isBoolean: (value: unknown, context?: ValidationContext): ValidationResult<boolean> => {
    if (typeof value !== 'boolean') {
      return Effect.fail(createValidationError(
        `Expected boolean, got ${typeof value}`,
        context,
        value
      ))
    }
    return Effect.succeed(value)
  },

  isArray: <T>(value: unknown, context?: ValidationContext): ValidationResult<T[]> => {
    if (!Array.isArray(value)) {
      return Effect.fail(createValidationError(
        `Expected array, got ${typeof value}`,
        context,
        value
      ))
    }
    return Effect.succeed(value as T[])
  },

  // Numeric validators
  isPositive: (value: number, context?: ValidationContext): ValidationResult<number> =>
    value > 0
      ? Effect.succeed(value)
      : Effect.fail(createValidationError('Must be positive', context, value)),

  isNonNegative: (value: number, context?: ValidationContext): ValidationResult<number> =>
    value >= 0
      ? Effect.succeed(value)
      : Effect.fail(createValidationError('Must be non-negative', context, value)),

  isInteger: (value: number, context?: ValidationContext): ValidationResult<number> =>
    Number.isInteger(value)
      ? Effect.succeed(value)
      : Effect.fail(createValidationError('Must be an integer', context, value)),

  inRange: (min: number, max: number) => 
    (value: number, context?: ValidationContext): ValidationResult<number> =>
      value >= min && value <= max
        ? Effect.succeed(value)
        : Effect.fail(createValidationError(
            `Must be between ${min} and ${max}`, 
            context, 
            { value, min, max }
          )),

  // String validators
  minLength: (min: number) =>
    (value: string, context?: ValidationContext): ValidationResult<string> =>
      value.length >= min
        ? Effect.succeed(value)
        : Effect.fail(createValidationError(
            `Minimum length is ${min}`,
            context,
            { value, length: value.length, min }
          )),

  maxLength: (max: number) =>
    (value: string, context?: ValidationContext): ValidationResult<string> =>
      value.length <= max
        ? Effect.succeed(value)
        : Effect.fail(createValidationError(
            `Maximum length is ${max}`,
            context,
            { value, length: value.length, max }
          )),

  matches: (pattern: RegExp, patternName?: string) =>
    (value: string, context?: ValidationContext): ValidationResult<string> =>
      pattern.test(value)
        ? Effect.succeed(value)
        : Effect.fail(createValidationError(
            `Must match ${patternName || 'pattern'}`,
            context,
            { value, pattern: pattern.toString() }
          )),

  // Array validators
  minItems: <T>(min: number) =>
    (value: T[], context?: ValidationContext): ValidationResult<T[]> =>
      value.length >= min
        ? Effect.succeed(value)
        : Effect.fail(createValidationError(
            `Minimum ${min} items required`,
            context,
            { value, length: value.length, min }
          )),

  maxItems: <T>(max: number) =>
    (value: T[], context?: ValidationContext): ValidationResult<T[]> =>
      value.length <= max
        ? Effect.succeed(value)
        : Effect.fail(createValidationError(
            `Maximum ${max} items allowed`,
            context,
            { value, length: value.length, max }
          )),

  // Object validators
  hasProperty: <T>(property: keyof T) =>
    (value: T, context?: ValidationContext): ValidationResult<T> =>
      property in value
        ? Effect.succeed(value)
        : Effect.fail(createValidationError(
            `Missing required property: ${String(property)}`,
            context,
            { value, property }
          )),

  // Custom validators
  custom: <T>(
    predicate: (value: T) => boolean,
    message: string
  ) => 
    (value: T, context?: ValidationContext): ValidationResult<T> =>
      predicate(value)
        ? Effect.succeed(value)
        : Effect.fail(createValidationError(message, context, value)),
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
  rule: <T>(
    state: ValidationChainState<T>,
    validator: ValidatorFn<T>,
    name?: string,
    message?: string
  ): ValidationChainState<T> => ({
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
  with: <T>(
    state: ValidationChainState<T>,
    ...validators: ValidatorFn<T>[]
  ): ValidationChainState<T> => ({
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
      Effect.flatMap(value => {
        return state.rules.reduce(
          (acc, rule) => 
            pipe(
              acc,
              Effect.flatMap(v => rule.validate(v, state.context))
            ),
          Effect.succeed(value)
        )
      })
    ),

  /**
   * Execute validation and return result with rule details
   */
  validateDetailed: <T>(state: ValidationChainState<T>): Effect.Effect<{
    value: T
    passed: string[]
    failed: Array<{ rule: string; error: ValidationError }>
  }, never, never> => {
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
            Effect.flatMap(currentValue =>
              pipe(
                rule.validate(currentValue, state.context),
                Effect.map(validValue => {
                  results.passed.push(rule.name)
                  return validValue
                }),
                Effect.catchAll(error => {
                  results.failed.push({ rule: rule.name, error })
                  return Effect.succeed(currentValue) // Continue with current value
                })
              )
            )
          ),
        Effect.succeed(state.initialValue)
      ),
      Effect.map(() => results)
    )
  },
}

// Validation utilities
export const ValidationUtils = {
  // Create a validation chain
  validate: <T>(value: T, context?: ValidationContext) =>
    ValidationChain.create(value, context),

  // Validate using Schema
  validateSchema: <I, A>(schema: Schema.Schema<A, I>) =>
    (value: I, context?: ValidationContext): ValidationResult<A> =>
      pipe(
        Schema.decodeUnknown(schema)(value),
        Effect.mapError(parseError => 
          createValidationError(
            'Schema validation failed',
            context,
            parseError
          )
        )
      ),

  // Validate object properties
  validateObject: <T extends Record<string, unknown>>(
    value: T,
    validators: Partial<{ [K in keyof T]: ValidatorFn<T[K]> }>,
    context?: ValidationContext
  ): ValidationResult<T> => {
    const entries = Object.entries(validators) as Array<[keyof T, ValidatorFn<T[keyof T]>]>
    
    return pipe(
      entries.reduce(
        (acc, [key, validator]) =>
          pipe(
            acc,
            Effect.flatMap(obj => 
              pipe(
                validator(obj[key], { ...context, field: String(key) }),
                Effect.map(validValue => ({
                  ...obj,
                  [key]: validValue,
                }))
              )
            )
          ),
        Effect.succeed(value)
      )
    )
  },

  // Validate array elements
  validateArray: <T>(
    array: T[],
    validator: ValidatorFn<T>,
    context?: ValidationContext
  ): ValidationResult<T[]> => {
    return pipe(
      array.reduce(
        (acc, item, index) =>
          pipe(
            acc,
            Effect.flatMap(validArray =>
              pipe(
                validator(item, { ...context, field: `[${index}]` }),
                Effect.map(validItem => [...validArray, validItem])
              )
            )
          ),
        Effect.succeed([] as T[])
      )
    )
  },

  // Conditional validation
  when: <T>(
    condition: (value: T) => boolean,
    validator: ValidatorFn<T>
  ) => 
    (value: T, context?: ValidationContext): ValidationResult<T> =>
      condition(value) ? validator(value, context) : Effect.succeed(value),

  // Combine multiple validators with OR logic
  oneOf: <T>(...validators: ValidatorFn<T>[]) =>
    (value: T, context?: ValidationContext): ValidationResult<T> => {
      const errors: ValidationError[] = []
      
      for (const validator of validators) {
        const result = validator(value, context)
        if (Effect.isEffect(result)) {
          // Run the effect to get the result
          return pipe(
            result,
            Effect.catchAll(error => {
              errors.push(error)
              if (errors.length === validators.length) {
                return Effect.fail(createValidationError(
                  'None of the validation alternatives succeeded',
                  context,
                  errors
                ))
              }
              return Effect.fail(error) // Continue to next validator
            })
          )
        }
      }
      
      return Effect.fail(createValidationError(
        'No validators provided',
        context
      ))
    },

  // Debug validation
  debug: <T>(label?: string) =>
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
  // Position validation
  position: ValidationUtils.validateObject({
    x: Validators.isNumber,
    y: Validators.isNumber,
    z: Validators.isNumber,
  }),

  // Vector3 validation
  vector3: ValidationUtils.validateObject({
    x: Validators.isNumber,
    y: Validators.isNumber,
    z: Validators.isNumber,
  }),

  // Entity ID validation
  entityId: pipe(
    Validators.isString,
    (validator) => (value: unknown, context?: ValidationContext) =>
      pipe(
        validator(value, context),
        Effect.flatMap(str =>
          str.length > 0
            ? Effect.succeed(str)
            : Effect.fail(createValidationError('Entity ID cannot be empty', context, str))
        )
      )
  ),

  // Chunk coordinate validation
  chunkCoordinate: ValidationUtils.validateObject({
    x: pipe(Validators.isNumber, Validators.isInteger),
    z: pipe(Validators.isNumber, Validators.isInteger),
  }),

  // Component data validation
  componentData: <T extends Record<string, unknown>>(
    validators: { [K in keyof T]: ValidatorFn<T[K]> }
  ) => ValidationUtils.validateObject(validators),
}

// Export helper for creating component-specific validators
export const createComponentValidator = (component: string) => ({
  validate: <T>(value: T, field?: string, operation?: string) =>
    ValidationUtils.validate(value, { component, field, operation }),
  
  validators: Validators,
  utils: ValidationUtils,
  game: GameValidators,
})