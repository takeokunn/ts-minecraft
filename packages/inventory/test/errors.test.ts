import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { InventoryError, RecipeError } from '../domain/errors'

describe('domain/errors', () => {
  describe('InventoryError', () => {
    it('has the correct _tag', () => {
      const err = new InventoryError({ operation: 'getSlot' })
      expect(err._tag).toBe('InventoryError')
    })

    it('message without cause', () => {
      const err = new InventoryError({ operation: 'setSlot' })
      expect(err.message).toBe('Inventory error [setSlot]')
    })

    it('message with cause', () => {
      const err = new InventoryError({ operation: 'addBlock', cause: 'slot index out of range' })
      expect(err.message).toBe('Inventory error [addBlock]: slot index out of range')
    })

    it('message with Error object as cause', () => {
      const cause = new Error('underlying problem')
      const err = new InventoryError({ operation: 'removeBlock', cause })
      expect(err.message).toBe(`Inventory error [removeBlock]: ${String(cause)}`)
    })

    it('is an instance of Error', () => {
      const err = new InventoryError({ operation: 'getSlot' })
      expect(err).toBeInstanceOf(Error)
    })
  })

  describe('RecipeError', () => {
    it('has the correct _tag', () => {
      const err = new RecipeError({ operation: 'craft' })
      expect(err._tag).toBe('RecipeError')
    })

    it('message without cause', () => {
      const err = new RecipeError({ operation: 'findById' })
      expect(err.message).toBe('Recipe error [findById]')
    })

    it('message with cause', () => {
      const err = new RecipeError({ operation: 'craft', cause: 'insufficient ingredients' })
      expect(err.message).toBe('Recipe error [craft]: insufficient ingredients')
    })

    it('message with Error object as cause', () => {
      const cause = new Error('recipe not found')
      const err = new RecipeError({ operation: 'findById', cause })
      expect(err.message).toBe(`Recipe error [findById]: ${String(cause)}`)
    })

    it('is an instance of Error', () => {
      const err = new RecipeError({ operation: 'craft' })
      expect(err).toBeInstanceOf(Error)
    })
  })
})
