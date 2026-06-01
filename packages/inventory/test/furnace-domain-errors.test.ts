import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { FurnaceError } from '../domain/furnace-errors'

describe('furnace/domain/errors', () => {
  describe('FurnaceError.message', () => {
    it('includes cause when cause is provided', () => {
      const err = new FurnaceError({ operation: 'startSmelting', cause: 'out of fuel' })
      expect(err.message).toBe('Furnace error [startSmelting]: out of fuel')
    })

    it('omits cause suffix when cause is not provided', () => {
      const err = new FurnaceError({ operation: 'tick' })
      expect(err.message).toBe('Furnace error [tick]')
    })

    it('has the correct _tag', () => {
      const err = new FurnaceError({ operation: 'collectOutput' })
      expect(err._tag).toBe('FurnaceError')
    })
  })
})
