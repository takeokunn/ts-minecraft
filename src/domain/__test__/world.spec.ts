import { describe, it, expect } from '@effect/vitest'
import { EntityNotFoundError, ComponentNotFoundError } from '@/core/errors'
import { toEntityId } from '../entity'
import { Effect } from 'effect'

describe('World Errors', () => {
  it.effect('EntityNotFoundError should be created correctly', () =>
    Effect.sync(() => {
      const entityId = toEntityId(123)
      const error = new EntityNotFoundError(entityId)
      expect(error).toBeInstanceOf(EntityNotFoundError)
      expect(error.entityId).toBe(entityId)
      expect(error._tag).toBe('EntityNotFoundError')
      expect(error.timestamp).toBeInstanceOf(Date)
    }))

  it.effect('ComponentNotFoundError should be created correctly', () =>
    Effect.sync(() => {
      const entityId = toEntityId(456)
      const componentName = 'Position'
      const error = new ComponentNotFoundError(entityId, componentName)
      expect(error).toBeInstanceOf(ComponentNotFoundError)
      expect(error.entityId).toBe(entityId)
      expect(error.componentName).toBe(componentName)
      expect(error._tag).toBe('ComponentNotFoundError')
      expect(error.timestamp).toBeInstanceOf(Date)
    }))
})
