import { describe, it, expect } from 'vitest'
import { toEntityId, fromEntityId } from '../entity'
import { Effect } from 'effect'

describe('EntityId', () => {
  it('toEntityId should cast a number to an EntityId', async () => {
    const id = 123
    const entityId = await Effect.runPromise(toEntityId(id))
    expect(entityId).toBe(id)
  })

  it('fromEntityId should cast an EntityId back to a number', async () => {
    const id = 456
    const entityId = await Effect.runPromise(toEntityId(id))
    const numberId = await Effect.runPromise(fromEntityId(entityId))
    expect(numberId).toBe(id)
  })
})
