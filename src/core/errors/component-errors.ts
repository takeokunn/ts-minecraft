import { Data } from 'effect'
import type { EntityId } from '@/domain/values/entity-id'
import type { ComponentName } from '@/core/components'

/**
 * Component-related errors
 */

export class ComponentNotFoundError extends Data.TaggedError('ComponentNotFoundError')<{
  readonly entityId: EntityId
  readonly componentName: ComponentName | string
  readonly timestamp: Date
}> {
  constructor(entityId: EntityId, componentName: ComponentName | string) {
    super({ entityId, componentName, timestamp: new Date() })
  }
}

export class InvalidComponentDataError extends Data.TaggedError('InvalidComponentDataError')<{
  readonly componentName: string
  readonly reason: string
  readonly data?: unknown
  readonly timestamp: Date
}> {
  constructor(componentName: string, reason: string, data?: unknown) {
    super({ componentName, reason, data, timestamp: new Date() })
  }
}