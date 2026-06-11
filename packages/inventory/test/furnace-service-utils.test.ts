import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, HashMap, Option } from 'effect'
import {
  furnaceKey,
  positiveModulo,
  emptyFurnaceAtPosition,
  setFurnaceState,
  INITIAL_STATE,
} from '../domain/furnace-service-utils'

describe('inventory/furnace-service-utils', () => {
  describe('furnaceKey', () => {
    it('produces a deterministic string from integer coordinates', () => {
      expect(furnaceKey({ x: 1, y: 64, z: -3 })).toBe('1,64,-3')
    })

    it('produces a deterministic string from floating-point coordinates', () => {
      expect(furnaceKey({ x: 0.5, y: 0, z: 10 })).toBe('0.5,0,10')
    })

    it('uniquely identifies different positions', () => {
      const k1 = furnaceKey({ x: 1, y: 2, z: 3 })
      const k2 = furnaceKey({ x: 3, y: 2, z: 1 })
      expect(k1).not.toBe(k2)
    })

    it('returns the same key for the same position object', () => {
      const pos = { x: 10, y: 64, z: 20 }
      expect(furnaceKey(pos)).toBe(furnaceKey(pos))
    })
  })

  describe('positiveModulo', () => {
    it('behaves identically to % for positive inputs', () => {
      expect(positiveModulo(10, 3)).toBe(1)
      expect(positiveModulo(9, 3)).toBe(0)
    })

    it('wraps negative values to a positive remainder', () => {
      expect(positiveModulo(-1, 4)).toBe(3)
      expect(positiveModulo(-4, 4)).toBe(0)
      expect(positiveModulo(-5, 4)).toBe(3)
    })

    it('handles zero correctly', () => {
      expect(positiveModulo(0, 7)).toBe(0)
    })

    it('handles divisor equal to 1 (always 0)', () => {
      Arr.forEach([-3, 0, 5], (n) => {
        expect(positiveModulo(n, 1)).toBe(0)
      })
    })

    it('returns correct value when |value| > divisor', () => {
      expect(positiveModulo(13, 5)).toBe(3)
      expect(positiveModulo(-13, 5)).toBe(2)
    })
  })

  describe('emptyFurnaceAtPosition', () => {
    it('creates a furnace at the given position', () => {
      const pos = { x: 5, y: 64, z: -10 }
      const furnace = emptyFurnaceAtPosition(pos)
      expect(furnace.position).toEqual(pos)
    })

    it('has None for input, fuel, and output', () => {
      const furnace = emptyFurnaceAtPosition({ x: 0, y: 0, z: 0 })
      expect(Option.isNone(furnace.input)).toBe(true)
      expect(Option.isNone(furnace.fuel)).toBe(true)
      expect(Option.isNone(furnace.output)).toBe(true)
    })

    it('has zero progress', () => {
      const furnace = emptyFurnaceAtPosition({ x: 0, y: 0, z: 0 })
      expect(furnace.progressSecs).toBe(0)
    })

    it('has None activeRecipeId', () => {
      const furnace = emptyFurnaceAtPosition({ x: 0, y: 0, z: 0 })
      expect(Option.isNone(furnace.activeRecipeId)).toBe(true)
    })
  })

  describe('setFurnaceState', () => {
    it('inserts a furnace into the state', () => {
      const pos = { x: 1, y: 64, z: 1 }
      const furnace = emptyFurnaceAtPosition(pos)
      const nextState = setFurnaceState(INITIAL_STATE, furnace)
      const key = furnaceKey(pos)
      expect(Option.isSome(HashMap.get(nextState.furnaces, key))).toBe(true)
    })

    it('updates an existing furnace (upsert semantics)', () => {
      const pos = { x: 1, y: 64, z: 1 }
      const furnace1 = emptyFurnaceAtPosition(pos)
      const state1 = setFurnaceState(INITIAL_STATE, furnace1)
      const furnace2 = { ...furnace1, progressSecs: 5 }
      const state2 = setFurnaceState(state1, furnace2)
      const key = furnaceKey(pos)
      const stored = Option.getOrThrow(HashMap.get(state2.furnaces, key))
      expect(stored.progressSecs).toBe(5)
    })

    it('preserves the selectedFurnacePosition from the input state', () => {
      const nextState = setFurnaceState(INITIAL_STATE, emptyFurnaceAtPosition({ x: 0, y: 0, z: 0 }))
      expect(Option.isNone(nextState.selectedFurnacePosition)).toBe(true)
    })

    it('does not mutate the original state', () => {
      const pos = { x: 0, y: 64, z: 0 }
      const before = HashMap.size(INITIAL_STATE.furnaces)
      setFurnaceState(INITIAL_STATE, emptyFurnaceAtPosition(pos))
      expect(HashMap.size(INITIAL_STATE.furnaces)).toBe(before)
    })
  })
})
