/**
 * Type Guards and Validation Utilities for Domain Types
 *
 * This module provides type-safe validation functions to replace
 * type assertions (as) throughout the domain layer.
 * Uses Effect-TS patterns for proper error handling.
 */

import * as S from 'effect/Schema'
import * as Effect from 'effect/Effect'
import * as Predicate from 'effect/Predicate'
import * as Option from 'effect/Option'
import { pipe } from 'effect'

// JSON value type for better type safety than unknown
export type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | JsonValue[] 
  | { [key: string]: JsonValue }
import { ComponentNameSchema, type ComponentName } from '@domain/entities/components/component-schemas'
import { BlockTypeSchema } from '@domain/constants/block-types'
import { BlockPropertiesUtils } from '@domain/constants/block-properties'

// Re-export BlockType from proper location
export type { BlockType } from '@domain/constants/block-types'

/**
 * Schema and Type Guard for FaceDirection
 */
export const FaceDirectionSchema = S.Literal('front', 'back', 'right', 'left', 'top', 'bottom')
export type FaceDirection = S.Schema.Type<typeof FaceDirectionSchema>

export const isFaceDirection = (value: JsonValue | null | undefined): value is FaceDirection =>
  S.is(FaceDirectionSchema)(value)

export const safeParseFaceDirection = (value: JsonValue | null | undefined): Effect.Effect<FaceDirection, S.ParseResult.ParseError> =>
  pipe(value, S.decode(FaceDirectionSchema))

/**
 * Schema and Type Guard for EntityId (number-based for compatibility with current service)
 */
export const EntityIdNumberSchema = pipe(S.Number, S.int(), S.positive(), S.brand('EntityId'))
export type EntityIdNumber = S.Schema.Type<typeof EntityIdNumberSchema>

export const isEntityIdNumber = (value: JsonValue | null | undefined): value is EntityIdNumber =>
  S.is(EntityIdNumberSchema)(value)

export const safeParseEntityIdNumber = (value: JsonValue | null | undefined): Effect.Effect<EntityIdNumber, S.ParseResult.ParseError> =>
  pipe(value, S.decode(EntityIdNumberSchema))

/**
 * BlockType Validation Functions
 */
export const isBlockType = (value: JsonValue | null | undefined): value is S.Schema.Type<typeof BlockTypeSchema> =>
  S.is(BlockTypeSchema)(value)

export const safeParseBlockType = (value: JsonValue | null | undefined): Effect.Effect<S.Schema.Type<typeof BlockTypeSchema>, S.ParseResult.ParseError> =>
  pipe(value, S.decode(BlockTypeSchema))

/**
 * Alternative BlockType validation using block properties (for compatibility)
 */
export const isValidBlockTypeString = (value: string): value is keyof typeof import('@domain/constants/block-properties').BLOCK_COLORS =>
  BlockPropertiesUtils.isValidBlockType(value)

export const safeParseBlockTypeFromString = (value: string): Effect.Effect<keyof typeof import('@domain/constants/block-properties').BLOCK_COLORS, Error> =>
  isValidBlockTypeString(value) 
    ? Effect.succeed(value)
    : Effect.fail(new Error(`Invalid block type: ${value}`))

/**
 * ComponentName Validation Functions
 */
export const isComponentName = (value: JsonValue | null | undefined): value is ComponentName =>
  S.is(ComponentNameSchema)(value)

export const safeParseComponentName = (value: JsonValue | null | undefined): Effect.Effect<ComponentName, S.ParseResult.ParseError> =>
  pipe(value, S.decode(ComponentNameSchema))

/**
 * Array validation helpers
 */
export const safeParseComponentNameArray = (value: JsonValue | null | undefined): Effect.Effect<readonly ComponentName[], S.ParseResult.ParseError> =>
  pipe(value, S.decode(S.Array(ComponentNameSchema)))

/**
 * Synchronous ComponentName array validation
 */
export const validateComponentNameArraySync = (keys: readonly string[]): ComponentName[] => {
  const validKeys: ComponentName[] = []
  for (const key of keys) {
    if (isComponentName(key)) {
      validKeys.push(key)
    }
  }
  return validKeys
}

/**
 * Object key validation helpers
 */
export const validateObjectKeysAsComponentNames = <T>(
  obj: Record<string, T>
): Effect.Effect<Record<ComponentName, T>, Error> =>
  Effect.gen(function* () {
    const keys = Object.keys(obj)
    const validatedKeys: ComponentName[] = []
    
    for (const key of keys) {
      if (isComponentName(key)) {
        validatedKeys.push(key)
      } else {
        return yield* Effect.fail(new Error(`Invalid component name: ${key}`))
      }
    }
    
    const validatedObj = validatedKeys.reduce((acc, key) => {
      acc[key] = obj[key]
      return acc
    }, {} as Record<ComponentName, T>) // Safe assertion: all keys have been validated as ComponentName
    
    return validatedObj
  })

/**
 * Biome surface/subsurface block validation for terrain generation
 */
export interface BiomeBlockConfig {
  readonly surfaceBlock: JsonValue
  readonly subsurfaceBlock: JsonValue
}

export const validateBiomeBlockType = (
  block: JsonValue
): Effect.Effect<S.Schema.Type<typeof BlockTypeSchema>, Error> =>
  Effect.gen(function* () {
    // First try the schema validation
    if (typeof block === 'string' && isBlockType(block)) {
      return yield* safeParseBlockType(block)
    }
    
    // Fallback for compatibility with block properties
    if (typeof block === 'string' && isValidBlockTypeString(block)) {
      return yield* safeParseBlockTypeFromString(block)
    }
    
    return yield* Effect.fail(new Error(`Invalid biome block type: ${block}`))
  })

/**
 * Synchronous biome block validation with fallback
 */
export const validateBiomeBlockTypeSync = (
  block: JsonValue,
  fallback: S.Schema.Type<typeof BlockTypeSchema>
): S.Schema.Type<typeof BlockTypeSchema> => {
  // First try the schema validation
  if (typeof block === 'string' && isBlockType(block)) {
    return block
  }
  
  // Fallback for compatibility with block properties - no type assertion needed
  if (typeof block === 'string' && isValidBlockTypeString(block)) {
    // Safe because isValidBlockTypeString ensures the block is a valid key
    return block
  }
  
  return fallback
}

/**
 * Safe alternatives to type assertions
 */
export const TypeGuards = {
  FaceDirection: {
    is: isFaceDirection,
    parse: safeParseFaceDirection,
  },
  EntityId: {
    is: isEntityIdNumber,
    parse: safeParseEntityIdNumber,
  },
  BlockType: {
    is: isBlockType,
    parse: safeParseBlockType,
    parseFromString: safeParseBlockTypeFromString,
    validate: validateBiomeBlockType,
    validateSync: validateBiomeBlockTypeSync,
  },
  ComponentName: {
    is: isComponentName,
    parse: safeParseComponentName,
    parseArray: safeParseComponentNameArray,
    validateObjectKeys: validateObjectKeysAsComponentNames,
    validateArraySync: validateComponentNameArraySync,
  },
} as const

/**
 * Safe component name utilities
 */
export const getValidComponentNames = (components: Record<string, JsonValue>): string[] => {
  return Object.keys(components).filter((key) => 
    typeof key === 'string' && key.length > 0
  )
}

export const getValidComponentNamesAsComponentNames = (components: Record<string, JsonValue>): ComponentName[] => {
  return Object.keys(components).filter((key): key is ComponentName => 
    typeof key === 'string' && key.length > 0 && isComponentName(key)
  )
}

/**
 * Common type guards and utility functions using Effect-TS Predicate
 */
export const isRecord = Predicate.isRecord

// Enhanced record validation with Option
export const parseRecord = (value: JsonValue | null | undefined): Option.Option<Record<string, JsonValue>> =>
  pipe(
    value,
    Option.fromPredicate(isRecord)
  )

export const hasProperty = <T extends Record<string, JsonValue>>(
  obj: T, 
  key: string | symbol
): key is keyof T => {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export const isFunction = Predicate.isFunction

// Enhanced boolean parsing with Option
export const parseBoolean = (value: JsonValue | null | undefined): Option.Option<boolean> => {
  if (typeof value === 'boolean') return Option.some(value)
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower === 'true') return Option.some(true)
    if (lower === 'false') return Option.some(false)
  }
  if (typeof value === 'number') return Option.some(value !== 0)
  return Option.none()
}

export const safeBoolean = (value: JsonValue | null | undefined): boolean => {
  return pipe(
    parseBoolean(value),
    Option.getOrElse(() => false)
  )
}

// Vector3 Schema for type-safe validation
export const Vector3Schema = S.Struct({
  x: S.Number,
  y: S.Number,
  z: S.Number
})
export type Vector3 = S.Schema.Type<typeof Vector3Schema>

export const isVector3 = (value: JsonValue | null | undefined): value is Vector3 => {
  return S.is(Vector3Schema)(value)
}

export const safeParseVector3 = (value: JsonValue | null | undefined): Effect.Effect<Vector3, S.ParseResult.ParseError> =>
  pipe(value, S.decode(Vector3Schema))

export const getSafeNumberProperty = (obj: Record<string, JsonValue>, prop: string): number | undefined => {
  if (!hasProperty(obj, prop)) return undefined
  const value = obj[prop]
  return typeof value === 'number' ? value : undefined
}

export const isHTMLElement = (element: JsonValue | null | undefined | Element): element is HTMLElement => {
  return element instanceof HTMLElement
}

export const isHTMLInputElement = (element: JsonValue | null | undefined | Element): element is HTMLInputElement => {
  return element instanceof HTMLInputElement
}

export const hasFiles = (target: JsonValue | null | undefined | EventTarget): target is { files: FileList } => {
  return isRecord(target) && hasProperty(target, 'files') && target.files instanceof FileList
}

export const hasPerformanceMemory = (performance: Performance): performance is Performance & { memory: JsonValue } => {
  return hasProperty(performance, 'memory')
}

export const hasPerformanceObserver = (): boolean => {
  return typeof PerformanceObserver !== 'undefined'
}

// Enhanced number parsing with Option
export const parseNumber = (value: JsonValue | null | undefined): Option.Option<number> => {
  if (typeof value === 'number') return isNaN(value) ? Option.none() : Option.some(value)
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? Option.none() : Option.some(parsed)
  }
  return Option.none()
}

export const safeParseNumber = (value: JsonValue | null | undefined): number | undefined => {
  return pipe(
    parseNumber(value),
    Option.getOrElse(() => undefined as number | undefined)
  )
}