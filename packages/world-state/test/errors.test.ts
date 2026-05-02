import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { StorageError, BlockError } from '../domain/errors'

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

describe('BlockError', () => {
  it('message includes the blockType', () => {
    const err = new BlockError({ blockType: 'STONE', reason: 'cannot place here' })
    expect(err.message).toContain('STONE')
  })

  it('message includes the reason', () => {
    const err = new BlockError({ blockType: 'STONE', reason: 'cannot place here' })
    expect(err.message).toContain('cannot place here')
  })

  it('message includes the position when provided', () => {
    const err = new BlockError({
      blockType: 'DIRT',
      reason: 'out of bounds',
      position: [3, 64, -5] as const,
    })
    expect(err.message).toContain('3')
    expect(err.message).toContain('64')
    expect(err.message).toContain('-5')
  })

  it('message omits position when not provided', () => {
    const err = new BlockError({ blockType: 'GRASS', reason: 'invalid state' })
    expect(err.message).not.toContain('at (')
  })
})
