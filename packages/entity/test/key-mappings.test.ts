import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, HashSet } from 'effect'
import { KeyMappings } from '@ts-minecraft/entity'

describe('KeyMappings', () => {
  describe('movement keys', () => {
    it('MOVE_FORWARD maps to KeyW', () => {
      expect(KeyMappings.MOVE_FORWARD).toBe('KeyW')
    })

    it('MOVE_BACKWARD maps to KeyS', () => {
      expect(KeyMappings.MOVE_BACKWARD).toBe('KeyS')
    })

    it('MOVE_LEFT maps to KeyA', () => {
      expect(KeyMappings.MOVE_LEFT).toBe('KeyA')
    })

    it('MOVE_RIGHT maps to KeyD', () => {
      expect(KeyMappings.MOVE_RIGHT).toBe('KeyD')
    })

    it('JUMP maps to Space', () => {
      expect(KeyMappings.JUMP).toBe('Space')
    })

    it('SPRINT maps to ControlLeft', () => {
      expect(KeyMappings.SPRINT).toBe('ControlLeft')
    })

    it('SNEAK maps to ShiftLeft', () => {
      expect(KeyMappings.SNEAK).toBe('ShiftLeft')
    })
  })

  describe('action keys', () => {
    it('INVENTORY_OPEN maps to KeyE', () => {
      expect(KeyMappings.INVENTORY_OPEN).toBe('KeyE')
    })

    it('ESCAPE maps to Escape', () => {
      expect(KeyMappings.ESCAPE).toBe('Escape')
    })

    it('CAMERA_TOGGLE maps to F5', () => {
      expect(KeyMappings.CAMERA_TOGGLE).toBe('F5')
    })
  })

  describe('hotbar keys', () => {
    it('HOTBAR_SLOT_1 maps to Digit1', () => {
      expect(KeyMappings.HOTBAR_SLOT_1).toBe('Digit1')
    })

    it('HOTBAR_SLOT_2 maps to Digit2', () => {
      expect(KeyMappings.HOTBAR_SLOT_2).toBe('Digit2')
    })

    it('HOTBAR_SLOT_3 maps to Digit3', () => {
      expect(KeyMappings.HOTBAR_SLOT_3).toBe('Digit3')
    })

    it('HOTBAR_SLOT_4 maps to Digit4', () => {
      expect(KeyMappings.HOTBAR_SLOT_4).toBe('Digit4')
    })

    it('HOTBAR_SLOT_5 maps to Digit5', () => {
      expect(KeyMappings.HOTBAR_SLOT_5).toBe('Digit5')
    })

    it('HOTBAR_SLOT_6 maps to Digit6', () => {
      expect(KeyMappings.HOTBAR_SLOT_6).toBe('Digit6')
    })

    it('HOTBAR_SLOT_7 maps to Digit7', () => {
      expect(KeyMappings.HOTBAR_SLOT_7).toBe('Digit7')
    })

    it('HOTBAR_SLOT_8 maps to Digit8', () => {
      expect(KeyMappings.HOTBAR_SLOT_8).toBe('Digit8')
    })

    it('HOTBAR_SLOT_9 maps to Digit9', () => {
      expect(KeyMappings.HOTBAR_SLOT_9).toBe('Digit9')
    })
  })

  describe('value types', () => {
    it('all values are non-empty strings', () => {
      const values = Object.values(KeyMappings)
      Arr.forEach(values, (v) => {
        expect(typeof v).toBe('string')
        expect(v.length).toBeGreaterThan(0)
      })
    })

    it('has exactly 19 key bindings', () => {
      expect(Object.keys(KeyMappings).length).toBe(19)
    })
  })

  describe('uniqueness', () => {
    it('all key mapping values are unique (no key bound twice)', () => {
      const values = Object.values(KeyMappings)
      const unique = HashSet.fromIterable(values)
      expect(HashSet.size(unique)).toBe(values.length)
    })
  })
})
