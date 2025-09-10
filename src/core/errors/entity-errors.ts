import { Data } from 'effect'
import type { EntityId } from '@/domain/values/entity-id'

/**
 * Entity-related errors
 */

export class EntityNotFoundError extends Data.TaggedError('EntityNotFoundError')<{
  readonly entityId: EntityId
  readonly operation?: string
  readonly timestamp: Date
}> {
  constructor(entityId: EntityId, operation?: string) {
    super({ entityId, operation, timestamp: new Date() })
  }
}

export class EntityAlreadyExistsError extends Data.TaggedError('EntityAlreadyExistsError')<{
  readonly entityId: EntityId
  readonly timestamp: Date
}> {
  constructor(entityId: EntityId) {
    super({ entityId, timestamp: new Date() })
  }
}

export class InvalidEntityStateError extends Data.TaggedError('InvalidEntityStateError')<{
  readonly entityId: EntityId
  readonly reason: string
  readonly timestamp: Date
}> {
  constructor(entityId: EntityId, reason: string) {
    super({ entityId, reason, timestamp: new Date() })
  }
}