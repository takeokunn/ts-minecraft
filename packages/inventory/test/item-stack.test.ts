import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Option } from 'effect'
import {
  MAX_STACK_SIZE,
  createStack,
  addToStack,
  removeFromStack,
  canMerge,
  mergeStacks,
  maxStackFor,
  enchantmentsOf,
  enchantItem,
} from '../domain/item-stack'
import { isDurable, TOOL_MAX_DURABILITY } from '../domain/durability'
import type { InventoryItem } from '@ts-minecraft/core'

describe('domain/item-stack', () => {
  describe('maxStackFor', () => {
    it('returns 64 for regular block DIRT', () => {
      expect(maxStackFor('DIRT')).toBe(64)
    })

    // Guards the single-source-of-truth: TOOL_BLOCK_TYPES is derived from the
    // durability table, so every durable tool must be non-stackable and vice versa.
    it('treats exactly the durable tools as non-stackable (no drift)', () => {
      Arr.forEach(Object.keys(TOOL_MAX_DURABILITY) as ReadonlyArray<InventoryItem>, (tool) => {
        expect(maxStackFor(tool)).toBe(1)
        expect(isDurable(tool)).toBe(true)
      })
      // A non-durable item stacks fully and is not a tool.
      expect(maxStackFor('DIRT')).toBe(MAX_STACK_SIZE)
      expect(isDurable('DIRT')).toBe(false)
    })

    it('returns 64 for regular block STONE', () => {
      expect(maxStackFor('STONE')).toBe(64)
    })

    it('returns 64 for regular block WOOD', () => {
      expect(maxStackFor('WOOD')).toBe(64)
    })

    it('returns 1 for WOODEN_SWORD', () => {
      expect(maxStackFor('WOODEN_SWORD')).toBe(1)
    })

    it('returns 1 for WOODEN_PICKAXE', () => {
      expect(maxStackFor('WOODEN_PICKAXE')).toBe(1)
    })

    it('returns 1 for STONE_PICKAXE', () => {
      expect(maxStackFor('STONE_PICKAXE')).toBe(1)
    })

    it('returns 1 for IRON_PICKAXE', () => {
      expect(maxStackFor('IRON_PICKAXE')).toBe(1)
    })

    it('returns 1 for DIAMOND_PICKAXE', () => {
      expect(maxStackFor('DIAMOND_PICKAXE')).toBe(1)
    })

    it('returns 1 for STONE_SWORD', () => {
      expect(maxStackFor('STONE_SWORD')).toBe(1)
    })

    it('returns 1 for IRON_SWORD', () => {
      expect(maxStackFor('IRON_SWORD')).toBe(1)
    })

    it('returns 1 for DIAMOND_SWORD', () => {
      expect(maxStackFor('DIAMOND_SWORD')).toBe(1)
    })
  })

  describe('createStack', () => {
    it('creates a stack with correct itemType and count', () => {
      const stack = createStack('DIRT', 10)
      expect(stack.itemType).toBe('DIRT')
      expect(stack.count).toBe(10)
    })

    it('default count is 1', () => {
      const stack = createStack('STONE')
      expect(stack.count).toBe(1)
    })

    it('clamps count to 1 when passed 0', () => {
      const stack = createStack('WOOD', 0)
      expect(stack.count).toBe(1)
    })

    it('clamps count to 1 when passed a negative value', () => {
      const stack = createStack('WOOD', -5)
      expect(stack.count).toBe(1)
    })

    it('clamps count to MAX_STACK_SIZE when passed 65', () => {
      const stack = createStack('STONE', 65)
      expect(stack.count).toBe(MAX_STACK_SIZE)
    })

    it('clamps count to MAX_STACK_SIZE when passed a very large value', () => {
      const stack = createStack('SAND', 999)
      expect(stack.count).toBe(MAX_STACK_SIZE)
    })

    it('accepts exactly MAX_STACK_SIZE without clamping', () => {
      const stack = createStack('GRAVEL', MAX_STACK_SIZE)
      expect(stack.count).toBe(MAX_STACK_SIZE)
    })

    it('clamps count to 1 for tool type WOODEN_SWORD when passed 5', () => {
      const stack = createStack('WOODEN_SWORD', 5)
      expect(stack.count).toBe(1)
    })

    it('accepts count=1 for tool type IRON_PICKAXE', () => {
      const stack = createStack('IRON_PICKAXE', 1)
      expect(stack.count).toBe(1)
    })
  })

  describe('addToStack', () => {
    it('adds items to stack', () => {
      const stack = createStack('DIRT', 10)
      const result = addToStack(stack, 5)
      expect(result.itemType).toBe('DIRT')
      expect(result.count).toBe(15)
    })

    it('caps at MAX_STACK_SIZE when adding would overflow', () => {
      const stack = createStack('STONE', 60)
      const result = addToStack(stack, 10)
      expect(result.count).toBe(MAX_STACK_SIZE)
    })

    it('caps at exactly MAX_STACK_SIZE when adding the exact remaining space', () => {
      const stack = createStack('STONE', 60)
      const result = addToStack(stack, 4)
      expect(result.count).toBe(MAX_STACK_SIZE)
    })

    it('preserves itemType after adding', () => {
      const stack = createStack('GLASS', 3)
      const result = addToStack(stack, 2)
      expect(result.itemType).toBe('GLASS')
    })

    it('tool stack at max (count=1) stays at 1 when adding more', () => {
      const stack = createStack('WOODEN_SWORD', 1)
      const result = addToStack(stack, 1)
      expect(result.count).toBe(1)
    })
  })

  describe('removeFromStack', () => {
    it('returns Option.some with reduced count', () => {
      const stack = createStack('DIRT', 10)
      const result = removeFromStack(stack, 3)
      expect(Option.isSome(result)).toBe(true)
      const unwrapped = Option.getOrThrow(result)
      expect(unwrapped.itemType).toBe('DIRT')
      expect(unwrapped.count).toBe(7)
    })

    it('returns Option.none when count becomes exactly 0', () => {
      const stack = createStack('STONE', 5)
      const result = removeFromStack(stack, 5)
      expect(Option.isNone(result)).toBe(true)
    })

    it('returns Option.none when removing more than available', () => {
      const stack = createStack('WOOD', 3)
      const result = removeFromStack(stack, 10)
      expect(Option.isNone(result)).toBe(true)
    })

    it('preserves itemType in the reduced stack', () => {
      const stack = createStack('SAND', 8)
      const result = removeFromStack(stack, 1)
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrThrow(result).itemType).toBe('SAND')
    })
  })

  describe('canMerge', () => {
    it('returns true for same itemType', () => {
      const a = createStack('DIRT', 5)
      const b = createStack('DIRT', 10)
      expect(canMerge(a, b)).toBe(true)
    })

    it('returns false for different itemType', () => {
      const a = createStack('DIRT', 5)
      const b = createStack('STONE', 10)
      expect(canMerge(a, b)).toBe(false)
    })
  })

  describe('mergeStacks', () => {
    it('full transfer when a has space and b fits entirely', () => {
      const a = createStack('DIRT', 10)
      const b = createStack('DIRT', 20)
      const [newA, remainderB] = mergeStacks(a, b)
      expect(newA.count).toBe(30)
      expect(Option.isNone(remainderB)).toBe(true)
    })

    it('partial transfer when b would overfill a', () => {
      const a = createStack('STONE', 60)
      const b = createStack('STONE', 10)
      const [newA, remainderB] = mergeStacks(a, b)
      expect(newA.count).toBe(MAX_STACK_SIZE)
      expect(Option.isSome(remainderB)).toBe(true)
      expect(Option.getOrThrow(remainderB).count).toBe(6)
    })

    it('returns [unchanged a, Option.some(b)] when types differ', () => {
      const a = createStack('DIRT', 10)
      const b = createStack('STONE', 5)
      const [newA, remainderB] = mergeStacks(a, b)
      expect(newA.count).toBe(10)
      expect(newA.itemType).toBe('DIRT')
      expect(Option.isSome(remainderB)).toBe(true)
      const unwrappedB = Option.getOrThrow(remainderB)
      expect(unwrappedB.itemType).toBe('STONE')
      expect(unwrappedB.count).toBe(5)
    })

    it('returns [full a, Option.some(b)] when a is already at MAX_STACK_SIZE', () => {
      const a = createStack('WOOD', MAX_STACK_SIZE)
      const b = createStack('WOOD', 3)
      const [newA, remainderB] = mergeStacks(a, b)
      expect(newA.count).toBe(MAX_STACK_SIZE)
      expect(Option.isSome(remainderB)).toBe(true)
      expect(Option.getOrThrow(remainderB).count).toBe(3)
    })

    it('remainder is Option.none when b is fully absorbed', () => {
      const a = createStack('GLASS', 50)
      const b = createStack('GLASS', 14)
      const [newA, remainderB] = mergeStacks(a, b)
      expect(newA.count).toBe(MAX_STACK_SIZE)
      expect(Option.isNone(remainderB)).toBe(true)
    })

    it('tool stack at max (count=1) cannot absorb more: returns [unchanged a, Option.some(b)]', () => {
      const a = createStack('WOODEN_SWORD', 1)
      const b = createStack('WOODEN_SWORD', 1)
      const [newA, remainderB] = mergeStacks(a, b)
      expect(newA.count).toBe(1)
      expect(Option.isSome(remainderB)).toBe(true)
      expect(Option.getOrThrow(remainderB).count).toBe(1)
      expect(Option.getOrThrow(remainderB).itemType).toBe('WOODEN_SWORD')
    })
  })
})

describe('enchantmentsOf', () => {
  it('returns [] for Option.none (empty slot)', () => {
    expect(enchantmentsOf(Option.none())).toEqual([])
  })

  it('returns [] when the stack has no enchantments', () => {
    const stack = createStack('STONE', 1)
    expect(enchantmentsOf(Option.some(stack))).toEqual([])
  })

  it('returns the enchantment list when present', () => {
    const base = createStack('BOW', 1)
    const enchanted = enchantItem(base, { type: 'POWER', level: 3 })
    const result = enchantmentsOf(Option.some(enchanted))
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ type: 'POWER', level: 3 })
  })

  it('returns all enchantments when multiple are present', () => {
    const base = createStack('BOW', 1)
    const step1 = enchantItem(base, { type: 'POWER', level: 2 })
    const step2 = enchantItem(step1, { type: 'INFINITY', level: 1 })
    expect(enchantmentsOf(Option.some(step2))).toHaveLength(2)
  })
})
