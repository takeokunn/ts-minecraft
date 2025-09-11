import { defineError } from './generator'
import { EntityError } from './base-errors'
import type { EntityId } from '@/domain/value-objects/entity-id.vo'

/**
 * Entity not found in the ECS system
 * Recovery: Fallback to default entity or skip operation
 */
export const EntityNotFoundError = defineError<{
  readonly entityId: EntityId
  readonly operation?: string
  readonly searchContext?: string
}>('EntityNotFoundError', EntityError, 'fallback', 'medium')

/**
 * Attempt to create an entity that already exists
 * Recovery: Return existing entity or generate new ID
 */
export const EntityAlreadyExistsError = defineError<{
  readonly entityId: EntityId
  readonly existingEntityData?: Record<string, unknown>
}>('EntityAlreadyExistsError', EntityError, 'fallback', 'low')

/**
 * Entity is in an invalid state for the requested operation
 * Recovery: Reset entity state or skip operation
 */
export const InvalidEntityStateError = defineError<{
  readonly entityId: EntityId
  readonly reason: string
  readonly currentState?: string
  readonly expectedState?: string
}>('InvalidEntityStateError', EntityError, 'fallback', 'medium')

/**
 * Entity creation failed due to invalid parameters
 * Recovery: Use default parameters or prompt for correction
 */
export const EntityCreationError = defineError<{
  readonly entityType: string
  readonly invalidParameters: Record<string, unknown>
  readonly validationErrors: string[]
}>('EntityCreationError', EntityError, 'user-prompt', 'high')

/**
 * Entity destruction failed
 * Recovery: Force cleanup or mark for later cleanup
 */
export const EntityDestructionError = defineError<{
  readonly entityId: EntityId
  readonly reason: string
  readonly blockedBy?: string[]
}>('EntityDestructionError', EntityError, 'retry', 'medium')

/**
 * Entity archetype mismatch
 * Recovery: Convert entity or use compatible archetype
 */
export const EntityArchetypeMismatchError = defineError<{
  readonly entityId: EntityId
  readonly expectedArchetype: string
  readonly actualArchetype: string
  readonly operation: string
}>('EntityArchetypeMismatchError', EntityError, 'fallback', 'medium')

/**
 * Entity reference is stale or points to destroyed entity
 * Recovery: Update reference or remove from collections
 */
export const StaleEntityReferenceError = defineError<{
  readonly entityId: EntityId
  readonly referenceSource: string
  readonly lastKnownState?: string
}>('StaleEntityReferenceError', EntityError, 'ignore', 'low')

/**
 * Entity exceeds system limits
 * Recovery: Queue for later processing or reject operation
 */
export const EntityLimitExceededError = defineError<{
  readonly currentCount: number
  readonly maxAllowed: number
  readonly entityType?: string
}>('EntityLimitExceededError', EntityError, 'fallback', 'medium')
