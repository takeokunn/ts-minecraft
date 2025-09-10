import { Data } from 'effect'
import type { EntityId } from '@/domain/values/entity-id'
import type { Position } from '@/domain/values/coordinates'

/**
 * Physics-related errors
 */

export class CollisionDetectionError extends Data.TaggedError('CollisionDetectionError')<{
  readonly entityId: EntityId
  readonly position: Position
  readonly reason: string
  readonly timestamp: Date
}> {
  constructor(entityId: EntityId, position: Position, reason: string) {
    super({ entityId, position, reason, timestamp: new Date() })
  }
}