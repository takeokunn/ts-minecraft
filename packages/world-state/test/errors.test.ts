import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { StorageError } from '../domain/errors'

describe('StorageError', () => {
  it('message includes the operation name', () => {
    const err = new StorageError({ operation: 'loadChunk' })
    expect(err.message).toContain('loadChunk')
  })

  it('message includes the cause string when cause is an Error', () => {
    const cause = new Error('disk full')
    const err = new StorageError({ operation: 'saveChunk', cause })
    expect(err.message).toContain('disk full')
  })

  it('message does not include a trailing colon when no cause is given', () => {
    const err = new StorageError({ operation: 'deleteWorld' })
    expect(err.message.endsWith(':')).toBe(false)
  })

  it('message does not include a trailing colon when cause is undefined', () => {
    const err = new StorageError({ operation: 'deleteWorld', cause: undefined })
    expect(err.message.endsWith(':')).toBe(false)
  })
})
