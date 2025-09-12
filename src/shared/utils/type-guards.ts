/**
 * Type Guards and Validation Utilities for Domain Types
 *
 * This module provides type-safe validation functions to replace
 * type assertions (as) throughout the domain layer.
 * Uses Effect-TS patterns for proper error handling.
 */

import * as S from 'effect/Schema'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect'
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

export const isFaceDirection = (value: unknown): value is FaceDirection =>
  S.is(FaceDirectionSchema)(value)

export const safeParseFaceDirection = (value: unknown): Effect.Effect<FaceDirection, S.ParseResult.ParseError> =>
  pipe(value, S.decode(FaceDirectionSchema))

/**
 * Schema and Type Guard for EntityId (number-based for compatibility with current service)
 */
export const EntityIdNumberSchema = pipe(S.Number, S.int(), S.positive(), S.brand('EntityId'))
export type EntityIdNumber = S.Schema.Type<typeof EntityIdNumberSchema>

export const isEntityIdNumber = (value: unknown): value is EntityIdNumber =>
  S.is(EntityIdNumberSchema)(value)

export const safeParseEntityIdNumber = (value: unknown): Effect.Effect<EntityIdNumber, S.ParseResult.ParseError> =>
  pipe(value, S.decode(EntityIdNumberSchema))

/**
 * BlockType Validation Functions
 */
export const isBlockType = (value: unknown): value is S.Schema.Type<typeof BlockTypeSchema> =>
  S.is(BlockTypeSchema)(value)

export const safeParseBlockType = (value: unknown): Effect.Effect<S.Schema.Type<typeof BlockTypeSchema>, S.ParseResult.ParseError> =>
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
export const isComponentName = (value: unknown): value is ComponentName =>
  S.is(ComponentNameSchema)(value)

export const safeParseComponentName = (value: unknown): Effect.Effect<ComponentName, S.ParseResult.ParseError> =>
  pipe(value, S.decode(ComponentNameSchema))

/**
 * Array validation helpers
 */
export const safeParseComponentNameArray = (value: unknown): Effect.Effect<readonly ComponentName[], S.ParseResult.ParseError> =>
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
    }, {} as Record<ComponentName, T>)
    
    return validatedObj
  })

/**
 * Biome surface/subsurface block validation for terrain generation
 */
export interface BiomeBlockConfig {
  readonly surfaceBlock: unknown
  readonly subsurfaceBlock: unknown
}

export const validateBiomeBlockType = (
  block: unknown
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
  block: unknown,
  fallback: S.Schema.Type<typeof BlockTypeSchema>
): S.Schema.Type<typeof BlockTypeSchema> => {
  // First try the schema validation
  if (typeof block === 'string' && isBlockType(block)) {
    return block
  }
  
  // Fallback for compatibility with block properties
  if (typeof block === 'string' && isValidBlockTypeString(block)) {
    return block as S.Schema.Type<typeof BlockTypeSchema>
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
export const getValidComponentNames = (components: Record<string, unknown>): string[] => {
  return Object.keys(components).filter((key) => 
    typeof key === 'string' && key.length > 0
  )
}

export const getValidComponentNamesAsComponentNames = (components: Record<string, unknown>): ComponentName[] => {
  return Object.keys(components).filter((key) => 
    typeof key === 'string' && key.length > 0 && isComponentName(key)
  ) as ComponentName[]
}

/**
 * Common type guards and utility functions
 */
export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const hasProperty = <T extends Record<string, unknown>>(
  obj: T, 
  key: string | symbol
): key is keyof T => {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export const isFunction = (value: unknown): value is Function => {
  return typeof value === 'function'
}

export const safeBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  if (typeof value === 'number') return value !== 0
  return false
}

export const isVector3 = (value: unknown): value is { x: number; y: number; z: number } => {
  return isRecord(value) && 
    typeof (value as any).x === 'number' && 
    typeof (value as any).y === 'number' && 
    typeof (value as any).z === 'number'
}

export const getSafeNumberProperty = (obj: Record<string, unknown>, prop: string): number | undefined => {
  return hasProperty(obj, prop) && typeof obj[prop] === 'number' ? obj[prop] as number : undefined
}

export const isHTMLElement = (element: unknown): element is HTMLElement => {
  return element instanceof HTMLElement
}

export const isHTMLInputElement = (element: unknown): element is HTMLInputElement => {
  return element instanceof HTMLInputElement
}

export const hasFiles = (target: unknown): target is { files: FileList } => {
  return isRecord(target) && hasProperty(target, 'files') && target.files instanceof FileList
}

export const hasPerformanceMemory = (performance: Performance): performance is Performance & { memory: any } => {
  return hasProperty(performance, 'memory')
}

export const hasPerformanceObserver = (): boolean => {
  return typeof PerformanceObserver !== 'undefined'
}

export const safeParseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return isNaN(value) ? undefined : value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? undefined : parsed
  }
  return undefined
}