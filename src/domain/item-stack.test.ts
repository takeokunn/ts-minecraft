import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect, Either, Option, Schema } from 'effect'
import { expect } from 'vitest'
import {
  ItemStack,
  MAX_STACK_SIZE,
  addToStack,
  canMerge,
  createStack,
  mergeStacks,
  removeFromStack,
} from './item-stack'

describe('ItemStack', () => {
  describe('Schema.Class constructor', () => {
    it('should create an ItemStack with blockType STONE and count 1', () => {
      const stack = new ItemStack({ blockType: 'STONE', count: 1 })
      expect(stack.blockType).toBe('STONE')
      expect(stack.count).toBe(1)
    })

    it('should create an ItemStack with blockType AIR and count 64 (max stack)', () => {
      const stack = new ItemStack({ blockType: 'AIR', count: 64 })
      expect(stack.blockType).toBe('AIR')
      expect(stack.count).toBe(64)
    })

    it('should throw when count is 0 (below minimum of 1)', () => {
      expect(() => new ItemStack({ blockType: 'DIRT', count: 0 })).toThrow()
    })

    it('should throw when count is 65 (above maximum of 64)', () => {
      expect(() => new ItemStack({ blockType: 'DIRT', count: 65 })).toThrow()
    })
  })

  describe('Schema.Class validation', () => {
    it('should accept count=1 (minimum)', () => {
      const result = Schema.decodeUnknownSync(ItemStack)({ blockType: 'DIRT', count: 1 })
      expect(result.blockType).toBe('DIRT')
      expect(result.count).toBe(1)
    })

    it('should accept count=64 (maximum)', () => {
      const result = Schema.decodeUnknownSync(ItemStack)({ blockType: 'STONE', count: 64 })
      expect(result.blockType).toBe('STONE')
      expect(result.count).toBe(64)
    })

    it('should accept count=32 (mid-range)', () => {
      const result = Schema.decodeUnknownSync(ItemStack)({ blockType: 'GRASS', count: 32 })
      expect(result.blockType).toBe('GRASS')
      expect(result.count).toBe(32)
    })

    it('should reject count=0 (below minimum of 1)', () => {
      expect(() =>
        Schema.decodeUnknownSync(ItemStack)({ blockType: 'DIRT', count: 0 })
      ).toThrow()
    })

    it('should reject count=65 (above maximum of 64)', () => {
      expect(() =>
        Schema.decodeUnknownSync(ItemStack)({ blockType: 'DIRT', count: 65 })
      ).toThrow()
    })

    it('should reject invalid blockType', () => {
      expect(() =>
        Schema.decodeUnknownSync(ItemStack)({ blockType: 'NETHERRACK', count: 1 })
      ).toThrow()
    })

    it.effect('should decode via Schema.decode (Effect-based)', () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decode(ItemStack)({ blockType: 'WOOD', count: 10 })
        expect(decoded.blockType).toBe('WOOD')
        expect(decoded.count).toBe(10)
      })
    )
  })
})

describe('MAX_STACK_SIZE', () => {
  it('is 64', () => {
    expect(MAX_STACK_SIZE).toBe(64)
  })
})

describe('createStack', () => {
  it('should create a stack with the given blockType and count', () => {
    const stack = createStack('DIRT', 32)
    expect(stack.blockType).toBe('DIRT')
    expect(stack.count).toBe(32)
  })

  it('should default count to 1 when not provided', () => {
    const stack = createStack('STONE')
    expect(stack.count).toBe(1)
  })

  it('should clamp count to 1 at minimum (count=0)', () => {
    const stack = createStack('GRASS', 0)
    expect(stack.count).toBe(1)
  })

  it('should clamp count to 1 when count is negative', () => {
    const stack = createStack('STONE', -5)
    expect(stack.count).toBe(1)
  })

  it('should clamp count to MAX_STACK_SIZE at maximum (count=100)', () => {
    const stack = createStack('SAND', 100)
    expect(stack.count).toBe(MAX_STACK_SIZE)
  })

  it('should preserve count at exactly MAX_STACK_SIZE', () => {
    const stack = createStack('GRASS', 64)
    expect(stack.count).toBe(64)
  })
})

describe('addToStack', () => {
  it('should increase count by n (5 + 10 = 15)', () => {
    const stack = createStack('STONE', 5)
    const result = addToStack(stack, 10)
    expect(result.count).toBe(15)
  })

  it('should increase count by n (32 + 10 = 42)', () => {
    const stack = createStack('DIRT', 32)
    const result = addToStack(stack, 10)
    expect(result.count).toBe(42)
  })

  it('should preserve blockType', () => {
    const stack = createStack('STONE', 10)
    const result = addToStack(stack, 5)
    expect(result.blockType).toBe('STONE')
  })

  it('should clamp to MAX_STACK_SIZE on near-full overflow (60 + 10 = 64)', () => {
    const stack = createStack('STONE', 60)
    const result = addToStack(stack, 10)
    expect(result.count).toBe(64)
  })

  it('should clamp count to MAX_STACK_SIZE on overflow (60 + 100 = 64)', () => {
    const stack = createStack('DIRT', 60)
    const result = addToStack(stack, 100)
    expect(result.count).toBe(MAX_STACK_SIZE)
  })

  it('should return same count (64) when adding to a full stack', () => {
    const stack = createStack('STONE', 64)
    const result = addToStack(stack, 1)
    expect(result.count).toBe(64)
  })

  it('should reach exactly MAX_STACK_SIZE when adding fills the stack', () => {
    const stack = createStack('GRASS', 50)
    const result = addToStack(stack, 14)
    expect(result.count).toBe(MAX_STACK_SIZE)
  })

  it('should return a new ItemStack instance (not the same reference)', () => {
    const stack = createStack('STONE', 5)
    const result = addToStack(stack, 10)
    expect(result).not.toBe(stack)
  })
})

describe('removeFromStack', () => {
  const someCases = [
    ['removes 5 from 32, returning count 27', 'DIRT', 32, 5, 27],
    ['removes 3 from 5, returning count 2', 'STONE', 5, 3, 2],
    ['preserves blockType in remaining stack', 'WOOD', 20, 5, 15],
  ] as const

  Arr.forEach(someCases, ([desc, blockType, initial, remove, expected]) => {
    it(desc, () => {
      const result = Option.getOrThrow(removeFromStack(createStack(blockType, initial), remove))
      expect(result.count).toBe(expected)
      expect(result.blockType).toBe(blockType)
    })
  })

  const noneCases = [
    ['returns none when count reaches 0 (over-remove: 10 - 100)', 'STONE', 10, 100],
    ['returns none when removing exactly all items (5 - 5 = 0)', 'SAND', 5, 5],
    ['returns none when removing 1 from a stack of 1', 'STONE', 1, 1],
    ['returns none when removing more than available (5 - 10)', 'STONE', 5, 10],
  ] as const

  Arr.forEach(noneCases, ([desc, blockType, initial, remove]) => {
    it(desc, () => {
      expect(removeFromStack(createStack(blockType, initial), remove)).toStrictEqual(Option.none())
    })
  })
})

describe('canMerge', () => {
  it('should return true for stacks with the same blockType', () => {
    const a = createStack('DIRT', 10)
    const b = createStack('DIRT', 20)
    expect(canMerge(a, b)).toBe(true)
  })

  it('should return false for stacks with different blockTypes', () => {
    const a = createStack('DIRT', 10)
    const b = createStack('STONE', 20)
    expect(canMerge(a, b)).toBe(false)
  })

  it('should return true for same blockType regardless of count difference', () => {
    const a = createStack('GRASS', 1)
    const b = createStack('GRASS', 64)
    expect(canMerge(a, b)).toBe(true)
  })
})

describe('mergeStacks', () => {
  const noRemainderCases = [
    ['merges fully when combined count is within MAX_STACK_SIZE (30 + 20 = 50)', 'DIRT', 30, 20, 50],
    ['fully merges B into A when sum is within MAX_STACK_SIZE (10 + 5 = 15)', 'STONE', 10, 5, 15],
    ['fully absorbs B when A(1) + B(1) = 2', 'STONE', 1, 1, 2],
    ['exactly fills A to MAX_STACK_SIZE (32 + 32 = 64)', 'STONE', 32, 32, 64],
  ] as const

  Arr.forEach(noRemainderCases, ([desc, blockType, countA, countB, expectedA]) => {
    it(desc, () => {
      const [newA, remainderB] = mergeStacks(createStack(blockType, countA), createStack(blockType, countB))
      expect(newA.count).toBe(expectedA)
      expect(remainderB).toStrictEqual(Option.none())
    })
  })

  const overflowCases = [
    ['leaves remainder when target cannot absorb all (60 + 10 = 64, rem 6)', 'STONE', 60, 10, 64, 6],
    ['leaves remainder when combined count exceeds MAX (50 + 30 = 64, rem 16)', 'DIRT', 50, 30, MAX_STACK_SIZE, 16],
    ['returns A unchanged and all of B as remainder when A is already full (64 + 5)', 'STONE', 64, 5, 64, 5],
    ['returns original A unchanged and all of B as remainder when A is full (64 + 10)', 'DIRT', MAX_STACK_SIZE, 10, MAX_STACK_SIZE, 10],
    ['preserves blockType of B in the remainder (60 + 10)', 'WOOD', 60, 10, 64, 6],
    ['handles both full (64 + 64: A unchanged, B as remainder)', 'DIRT', 64, 64, 64, 64],
  ] as const

  Arr.forEach(overflowCases, ([desc, blockType, countA, countB, expectedA, expectedRem]) => {
    it(desc, () => {
      const [newA, remainderB] = mergeStacks(createStack(blockType, countA), createStack(blockType, countB))
      expect(newA.count).toBe(expectedA)
      const rem = Option.getOrThrow(remainderB)
      expect(rem.count).toBe(expectedRem)
      expect(rem.blockType).toBe(blockType)
    })
  })

  it('should not merge stacks of different blockTypes', () => {
    const a = createStack('STONE', 10)
    const b = createStack('DIRT', 5)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(10)
    expect(newA.blockType).toBe('STONE')
    expect(Option.getOrThrow(remainderB).blockType).toBe('DIRT')
  })

  it('should return A unchanged and B as some when blockTypes do not match (DIRT vs STONE)', () => {
    const a = createStack('DIRT', 10)
    const b = createStack('STONE', 10)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(10)
    expect(Option.getOrThrow(remainderB).blockType).toBe('STONE')
  })

  it('should preserve blockType of A in the merged result', () => {
    const a = createStack('GRASS', 10)
    const b = createStack('GRASS', 5)
    const [newA] = mergeStacks(a, b)
    expect(newA.blockType).toBe('GRASS')
  })
})

describe('createStack edge cases', () => {
  it('should clamp count=0 to 1', () => {
    const stack = createStack('DIRT', 0)
    expect(stack.count).toBe(1)
  })

  it('should clamp count=100 to 64', () => {
    const stack = createStack('STONE', 100)
    expect(stack.count).toBe(MAX_STACK_SIZE)
  })

  it('should clamp very large count (1000) to 64', () => {
    const stack = createStack('GRASS', 1000)
    expect(stack.count).toBe(MAX_STACK_SIZE)
  })

  it('should clamp very negative count (-100) to 1', () => {
    const stack = createStack('SAND', -100)
    expect(stack.count).toBe(1)
  })

  it('should accept count exactly at 1 (minimum)', () => {
    const stack = createStack('WOOD', 1)
    expect(stack.count).toBe(1)
  })

  it('should accept count exactly at 64 (maximum)', () => {
    const stack = createStack('STONE', 64)
    expect(stack.count).toBe(64)
  })

  it('should work for all block types', () => {
    const types = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'WATER', 'LEAVES', 'GLASS', 'SNOW', 'GRAVEL', 'COBBLESTONE'] as const
    Arr.forEach(types, (t) => {
      const stack = createStack(t, 10)
      expect(stack.blockType).toBe(t)
      expect(stack.count).toBe(10)
    })
  })
})

describe('addToStack edge cases', () => {
  it('should handle adding 0 items (no change)', () => {
    const stack = createStack('STONE', 10)
    const result = addToStack(stack, 0)
    expect(result.count).toBe(10)
  })

  it('should handle adding to already full stack (64 + 1 = 64)', () => {
    const stack = createStack('DIRT', 64)
    const result = addToStack(stack, 1)
    expect(result.count).toBe(64)
  })

  it('should handle adding to already full stack (64 + 100 = 64)', () => {
    const stack = createStack('GRASS', 64)
    const result = addToStack(stack, 100)
    expect(result.count).toBe(64)
  })

  it('should handle adding 1 to a single-item stack (1 + 1 = 2)', () => {
    const stack = createStack('STONE', 1)
    const result = addToStack(stack, 1)
    expect(result.count).toBe(2)
  })
})

describe('removeFromStack edge cases', () => {
  it('should deplete stack when removing all items (10 - 10 = none)', () => {
    expect(removeFromStack(createStack('STONE', 10), 10)).toStrictEqual(Option.none())
  })

  it('should deplete stack when removing more than available (5 - 100 = none)', () => {
    expect(removeFromStack(createStack('DIRT', 5), 100)).toStrictEqual(Option.none())
  })

  it('should return some with count=1 when removing from stack of 2 (2 - 1 = 1)', () => {
    const result = Option.getOrThrow(removeFromStack(createStack('WOOD', 2), 1))
    expect(result.count).toBe(1)
    expect(result.blockType).toBe('WOOD')
  })

  it('should return some with count=63 when removing 1 from full stack', () => {
    expect(Option.getOrThrow(removeFromStack(createStack('GRASS', 64), 1)).count).toBe(63)
  })

  it('should handle removing 0 items (partial: returns some with same count)', () => {
    expect(Option.getOrThrow(removeFromStack(createStack('STONE', 10), 0)).count).toBe(10)
  })
})

describe('mergeStacks edge cases', () => {
  it('should return unchanged A and B as some when types differ (DIRT vs STONE)', () => {
    const a = createStack('DIRT', 10)
    const b = createStack('STONE', 20)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(10)
    expect(newA.blockType).toBe('DIRT')
    const unwrapped = Option.getOrThrow(remainderB)
    expect(unwrapped.count).toBe(20)
    expect(unwrapped.blockType).toBe('STONE')
  })

  it('should return unchanged A and B as some when types differ (WOOD vs GLASS)', () => {
    const a = createStack('WOOD', 32)
    const b = createStack('GLASS', 16)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(32)
    expect(Option.getOrThrow(remainderB).count).toBe(16)
  })

  it('should handle merging into empty-like stack (1 + 63 = 64, no remainder)', () => {
    const [newA, remainderB] = mergeStacks(createStack('STONE', 1), createStack('STONE', 63))
    expect(newA.count).toBe(64)
    expect(remainderB).toStrictEqual(Option.none())
  })

  it('should handle merging when both are full (64 + 64: A unchanged, B as remainder)', () => {
    const [newA, remainderB] = mergeStacks(createStack('DIRT', 64), createStack('DIRT', 64))
    expect(newA.count).toBe(64)
    expect(Option.getOrThrow(remainderB).count).toBe(64)
  })

  it('should handle merging B of count 1 into nearly full A (63 + 1 = 64)', () => {
    const [newA, remainderB] = mergeStacks(createStack('SAND', 63), createStack('SAND', 1))
    expect(newA.count).toBe(64)
    expect(remainderB).toStrictEqual(Option.none())
  })
})

describe('canMerge edge cases', () => {
  it('should return true for AIR + AIR', () => {
    expect(canMerge(createStack('AIR', 1), createStack('AIR', 1))).toBe(true)
  })

  it('should return false for AIR + STONE', () => {
    expect(canMerge(createStack('AIR', 1), createStack('STONE', 1))).toBe(false)
  })

  it('should return true for same type regardless of count', () => {
    expect(canMerge(createStack('COBBLESTONE', 1), createStack('COBBLESTONE', 64))).toBe(true)
  })

  it('should be symmetric: canMerge(a, b) === canMerge(b, a)', () => {
    const a = createStack('DIRT', 10)
    const b = createStack('STONE', 20)
    expect(canMerge(a, b)).toBe(canMerge(b, a))
  })

  it('should be symmetric for same types: canMerge(a, b) === canMerge(b, a)', () => {
    const a = createStack('GRASS', 10)
    const b = createStack('GRASS', 20)
    expect(canMerge(a, b)).toBe(canMerge(b, a))
    expect(canMerge(a, b)).toBe(true)
  })
})

describe('ItemStack Schema validation', () => {
  it('should accept valid ItemStack with Schema.decodeUnknownSync', () => {
    const result = Schema.decodeUnknownSync(ItemStack)({ blockType: 'STONE', count: 32 })
    expect(result.blockType).toBe('STONE')
    expect(result.count).toBe(32)
  })

  it('should reject count below 1 via Schema.decodeUnknownSync', () => {
    expect(() => Schema.decodeUnknownSync(ItemStack)({ blockType: 'STONE', count: 0 })).toThrow()
  })

  it('should reject count above 64 via Schema.decodeUnknownSync', () => {
    expect(() => Schema.decodeUnknownSync(ItemStack)({ blockType: 'STONE', count: 65 })).toThrow()
  })

  it('should reject negative count via Schema.decodeUnknownSync', () => {
    expect(() => Schema.decodeUnknownSync(ItemStack)({ blockType: 'STONE', count: -1 })).toThrow()
  })

  it('should reject invalid blockType via Schema.decodeUnknownSync', () => {
    expect(() => Schema.decodeUnknownSync(ItemStack)({ blockType: 'NETHERRACK', count: 1 })).toThrow()
  })

  it('should reject missing blockType via Schema.decodeUnknownSync', () => {
    expect(() => Schema.decodeUnknownSync(ItemStack)({ count: 1 })).toThrow()
  })

  it('should reject missing count via Schema.decodeUnknownSync', () => {
    expect(() => Schema.decodeUnknownSync(ItemStack)({ blockType: 'STONE' })).toThrow()
  })

  it('should accept all twelve block types', () => {
    const types = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'WATER', 'LEAVES', 'GLASS', 'SNOW', 'GRAVEL', 'COBBLESTONE'] as const
    Arr.forEach(types, (t) => {
      const result = Schema.decodeUnknownSync(ItemStack)({ blockType: t, count: 1 })
      expect(result.blockType).toBe(t)
    })
  })

  it('should accept boundary count values (1 and 64)', () => {
    const min = Schema.decodeUnknownSync(ItemStack)({ blockType: 'DIRT', count: 1 })
    expect(min.count).toBe(1)
    const max = Schema.decodeUnknownSync(ItemStack)({ blockType: 'DIRT', count: 64 })
    expect(max.count).toBe(64)
  })

  it.effect('should decode via Effect-based Schema.decode', () =>
    Effect.gen(function* () {
      const decoded = yield* Schema.decode(ItemStack)({ blockType: 'LEAVES', count: 16 })
      expect(decoded.blockType).toBe('LEAVES')
      expect(decoded.count).toBe(16)
    })
  )

  it.effect('should fail Effect-based Schema.decode for invalid data', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(Schema.decodeUnknown(ItemStack)({ blockType: 'INVALID', count: 1 }))
      expect(Either.isLeft(result)).toBe(true)
    })
  )
})
