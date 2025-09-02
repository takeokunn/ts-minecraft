import { describe, it, expect } from 'vitest'
import { toEntityId, fromEntityId } from '../entity'

describe('EntityId', () => {
  it('toEntityId should cast a number to an EntityId', () => {
    const id = 123
    const entityId = toEntityId(id)
    expect(entityId).toBe(id)
  })

  it('fromEntityId should cast an EntityId back to a number', () => {
    const id = 456
    const entityId = toEntityId(id)
    const numberId = fromEntityId(entityId)
    expect(numberId).toBe(id)
  })
})
