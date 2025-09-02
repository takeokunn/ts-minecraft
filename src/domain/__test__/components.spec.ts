import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import * as C from '../components'
import { Effect } from 'effect'

describe('Components', () => {
  describe('InputState', () => {
    it('should create an initial InputState', () => {
      const initialState = Effect.runSync(C.createInputState())
      expect(initialState.forward).toBe(false)
      expect(initialState.backward).toBe(false)
      expect(initialState.left).toBe(false)
      expect(initialState.right).toBe(false)
      expect(initialState.jump).toBe(false)
      expect(initialState.sprint).toBe(false)
      expect(initialState.place).toBe(false)
      expect(initialState.destroy).toBe(false)
      expect(initialState.isLocked).toBe(false)
    })

    it('should set input state correctly', () => {
      const initialState = Effect.runSync(C.createInputState())
      const changes: Partial<C.InputState> = {
        forward: true,
        jump: true,
      }
      const updatedState = Effect.runSync(C.setInputState(initialState, changes))
      expect(updatedState.forward).toBe(true)
      expect(updatedState.jump).toBe(true)
      expect(updatedState.backward).toBe(false)
      expect(updatedState.left).toBe(false)
    })
  })
})