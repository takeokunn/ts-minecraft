import { describe, expect, it } from 'vitest'
import { EntityId } from '../entity'

describe('EntityId', () => {
  it('should create a branded EntityId from a number', () => {
    const id = 123
    const entityId = EntityId(id)
    expect(entityId).toBe(123)
  })

  it('should be assignable to a number', () => {
    const entityId = EntityId(456)
    const num: number = entityId
    expect(num).toBe(456)
  })
})
