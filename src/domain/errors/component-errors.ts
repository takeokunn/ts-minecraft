import { defineError } from './generator'
import { ComponentError } from './base-errors'
import type { EntityId } from '/value-objects/entity-id.vo'
import type { ComponentName } from '../components/index'

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

/**
 * Component already exists on entity
 * Recovery: Update existing component or ignore
 */
export const ComponentAlreadyExistsError = defineError<{
  readonly entityId: EntityId
  readonly componentName: ComponentName | string
  readonly existingData?: unknown
}>('ComponentAlreadyExistsError', ComponentError, 'ignore', 'low')

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
