import { defineError } from '@domain/errors/generator'
import { ComponentError } from '@domain/errors/base-errors'
import type { EntityId } from '@domain/value-objects/entity-id.vo'
import type { ComponentName } from '@domain/entities/components/index'
import * as S from '@effect/schema/Schema'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'

// Enhanced schema definitions for component error validation
const ComponentDataSchema = S.Union(
  S.Struct({
    _tag: S.String,
    data: S.Unknown
  }),
  S.Record(S.String, S.Unknown),
  S.Unknown
)

const RawDataSchema = S.Unknown
const ExistingDataSchema = S.Unknown
const SerializationTargetSchema = S.Literal('json', 'binary', 'network')
const ValidationErrorsSchema = S.Array(S.String)

// Validation utilities for component errors
export const ComponentErrorValidation = {
  validateComponentData: (data: unknown): Effect.Effect<{ data: unknown; type: string; isValid: boolean }, never, never> => {
    try {
      return Effect.succeed({
        data: typeof data === 'object' && data !== null ? data : { value: data },
        type: typeof data,
        isValid: data !== null && data !== undefined,
      })
    } catch {
      return Effect.succeed({
        data: { value: '[Unserializable]', original: String(data) },
        type: 'unserializable',
        isValid: false,
      })
    }
  },

  validateRawData: (rawData: unknown): Effect.Effect<{ rawData: unknown; size?: number; type: string }, never, never> => {
    const result = {
      rawData,
      type: typeof rawData,
      size: undefined as number | undefined,
    }

    if (typeof rawData === 'string') {
      result.size = rawData.length
    } else if (Array.isArray(rawData)) {
      result.size = rawData.length
    } else if (rawData instanceof ArrayBuffer) {
      result.size = rawData.byteLength
    } else if (typeof rawData === 'object' && rawData !== null) {
      try {
        result.size = Object.keys(rawData).length
      } catch {
        result.size = undefined
      }
    }

    return Effect.succeed(result)
  },

  validateExistingData: (existingData: unknown): Effect.Effect<{ data: unknown; type: string; hasData: boolean }, never, never> => {
    return Effect.succeed({
      data: existingData,
      type: typeof existingData,
      hasData: existingData !== null && existingData !== undefined,
    })
  },
}

/**
 * Component not found on entity
 * Recovery: Fallback to default component or skip operation
 */
export const ComponentNotFoundError = defineError<{
  readonly entityId: EntityId
  readonly componentName: ComponentName | string
  readonly operation?: string
}>('ComponentNotFoundError', ComponentError, 'fallback', 'medium')

/**
 * Component data is invalid or corrupted
 * Recovery: Reset to default values or prompt for correction
 */
export const InvalidComponentDataError = defineError<{
  readonly componentName: string
  readonly reason: string
  readonly invalidData?: unknown
  readonly validationErrors?: string[]
}>('InvalidComponentDataError', ComponentError, 'fallback', 'medium')

// Enhanced constructor with validation
export const createInvalidComponentDataError = (componentName: string, reason: string, invalidData?: unknown, validationErrors?: string[]) =>
  Effect.gen(function* () {
    const validatedData = invalidData ? yield* ComponentErrorValidation.validateComponentData(invalidData) : undefined
    return InvalidComponentDataError({
      componentName,
      reason,
      invalidData: validatedData,
      validationErrors,
    })
  })

/**
 * Component already exists on entity
 * Recovery: Update existing component or ignore
 */
export const ComponentAlreadyExistsError = defineError<{
  readonly entityId: EntityId
  readonly componentName: ComponentName | string
  readonly existingData?: unknown
}>('ComponentAlreadyExistsError', ComponentError, 'ignore', 'low')

// Enhanced constructor with validation
export const createComponentAlreadyExistsError = (entityId: EntityId, componentName: ComponentName | string, existingData?: unknown) =>
  Effect.gen(function* () {
    const validatedExistingData = existingData ? yield* ComponentErrorValidation.validateExistingData(existingData) : undefined
    return ComponentAlreadyExistsError({
      entityId,
      componentName,
      existingData: validatedExistingData,
    })
  })

/**
 * Component serialization failed
 * Recovery: Use fallback serialization or skip serialization
 */
export const ComponentSerializationError = defineError<{
  readonly componentName: string
  readonly data: unknown
  readonly serializationTarget: 'json' | 'binary' | 'network'
  readonly error: string
}>('ComponentSerializationError', ComponentError, 'fallback', 'medium')

// Enhanced constructor with validation
export const createComponentSerializationError = (componentName: string, data: unknown, serializationTarget: 'json' | 'binary' | 'network', error: string) =>
  Effect.gen(function* () {
    const validatedData = yield* ComponentErrorValidation.validateComponentData(data)
    return ComponentSerializationError({
      componentName,
      data: validatedData,
      serializationTarget,
      error,
    })
  })

/**
 * Component deserialization failed
 * Recovery: Use default component state or retry with fallback
 */
export const ComponentDeserializationError = defineError<{
  readonly componentName: string
  readonly rawData: unknown
  readonly expectedSchema?: string
  readonly error: string
}>('ComponentDeserializationError', ComponentError, 'fallback', 'medium')

// Enhanced constructor with validation
export const createComponentDeserializationError = (componentName: string, rawData: unknown, expectedSchema: string | undefined, error: string) =>
  Effect.gen(function* () {
    const validatedRawData = yield* ComponentErrorValidation.validateRawData(rawData)
    return ComponentDeserializationError({
      componentName,
      rawData: validatedRawData,
      expectedSchema,
      error,
    })
  })

/**
 * Component type mismatch
 * Recovery: Convert to expected type or use fallback component
 */
export const ComponentTypeMismatchError = defineError<{
  readonly entityId: EntityId
  readonly componentName: string
  readonly expectedType: string
  readonly actualType: string
  readonly operation: string
}>('ComponentTypeMismatchError', ComponentError, 'fallback', 'medium')

/**
 * Component dependency missing
 * Recovery: Add missing dependency or skip dependent operation
 */
export const ComponentDependencyError = defineError<{
  readonly entityId: EntityId
  readonly componentName: string
  readonly missingDependencies: string[]
  readonly operation: string
}>('ComponentDependencyError', ComponentError, 'fallback', 'high')

/**
 * Component lifecycle error
 * Recovery: Reset component state or remove component
 */
export const ComponentLifecycleError = defineError<{
  readonly entityId: EntityId
  readonly componentName: string
  readonly lifecycleStage: 'initialize' | 'update' | 'cleanup' | 'destroy'
  readonly reason: string
}>('ComponentLifecycleError', ComponentError, 'retry', 'medium')

/**
 * Component system capacity exceeded
 * Recovery: Queue for later processing or reject operation
 */
export const ComponentCapacityError = defineError<{
  readonly componentName: string
  readonly currentCount: number
  readonly maxCapacity: number
  readonly requestedOperation: string
}>('ComponentCapacityError', ComponentError, 'fallback', 'medium')
