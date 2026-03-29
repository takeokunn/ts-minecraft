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
        Schema.decodeUnknownSync(ItemStack)({ blockType: 'BEDROCK', count: 1 })
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
  it('should decrease count by n and return Option.some', () => {
    const stack = createStack('DIRT', 32)
    const result = removeFromStack(stack, 5)
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result).count).toBe(27)
  })

  it('should remove 3 from stack of 5, returning Option.some with count 2', () => {
    const stack = createStack('STONE', 5)
    const result = removeFromStack(stack, 3)
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result).count).toBe(2)
  })

  it('should preserve blockType in remaining Option.some stack', () => {
    const stack = createStack('WOOD', 20)
    const result = removeFromStack(stack, 5)
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result).blockType).toBe('WOOD')
  })

  it('should return Option.none when count reaches 0 (over-remove)', () => {
    const stack = createStack('STONE', 10)
    const result = removeFromStack(stack, 100)
    expect(Option.isNone(result)).toBe(true)
  })

  it('should return Option.none when removing exactly all items (5 - 5 = 0)', () => {
    const stack = createStack('SAND', 5)
    const result = removeFromStack(stack, 5)
    expect(Option.isNone(result)).toBe(true)
  })

  it('should return Option.none when removing 1 from a stack of 1', () => {
    const stack = createStack('STONE', 1)
    const result = removeFromStack(stack, 1)
    expect(Option.isNone(result)).toBe(true)
  })

  it('should return Option.none when removing more than available (5 - 10)', () => {
    const stack = createStack('STONE', 5)
    const result = removeFromStack(stack, 10)
    expect(Option.isNone(result)).toBe(true)
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
  it('should merge stacks fully when combined count is within MAX_STACK_SIZE', () => {
    const a = createStack('DIRT', 30)
    const b = createStack('DIRT', 20)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(50)
    expect(Option.isNone(remainderB)).toBe(true)
  })

  it('should fully merge B into A when sum exactly equals MAX_STACK_SIZE', () => {
    const a = createStack('STONE', 10)
    const b = createStack('STONE', 5)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(15)
    expect(Option.isNone(remainderB)).toBe(true)
  })

  it('should leave remainder when target stack cannot absorb all (60 + 10 = overflow)', () => {
    const a = createStack('STONE', 60)
    const b = createStack('STONE', 10)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(64)
    expect(Option.isSome(remainderB)).toBe(true)
    expect(Option.getOrThrow(remainderB).count).toBe(6)
  })

  it('should leave remainder when combined count exceeds MAX_STACK_SIZE (50 + 30 overflow)', () => {
    const a = createStack('DIRT', 50)
    const b = createStack('DIRT', 30)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(MAX_STACK_SIZE)
    expect(Option.isSome(remainderB)).toBe(true)
    expect(Option.getOrThrow(remainderB).count).toBe(16)
  })

  it('should return A unchanged and all of B as remainder when A is already full', () => {
    const a = createStack('STONE', 64)
    const b = createStack('STONE', 5)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(64)
    expect(Option.isSome(remainderB)).toBe(true)
    expect(Option.getOrThrow(remainderB).count).toBe(5)
  })

  it('should return original A unchanged and all of B as remainder when A is full (MAX_STACK_SIZE)', () => {
    const a = createStack('DIRT', MAX_STACK_SIZE)
    const b = createStack('DIRT', 10)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(MAX_STACK_SIZE)
    expect(Option.isSome(remainderB)).toBe(true)
    expect(Option.getOrThrow(remainderB).count).toBe(10)
  })

  it('should not merge stacks of different blockTypes', () => {
    const a = createStack('STONE', 10)
    const b = createStack('DIRT', 5)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(10)
    expect(newA.blockType).toBe('STONE')
    expect(Option.isSome(remainderB)).toBe(true)
    expect(Option.getOrThrow(remainderB).blockType).toBe('DIRT')
  })

  it('should return A unchanged and B as Option.some when blockTypes do not match (DIRT vs STONE)', () => {
    const a = createStack('DIRT', 10)
    const b = createStack('STONE', 10)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(10)
    expect(Option.isSome(remainderB)).toBe(true)
    expect(Option.getOrThrow(remainderB).blockType).toBe('STONE')
  })

  it('should fully absorb B when A(1) + B(1) = 2 is within MAX_STACK_SIZE', () => {
    const a = createStack('STONE', 1)
    const b = createStack('STONE', 1)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(2)
    expect(Option.isNone(remainderB)).toBe(true)
  })

  it('should preserve blockType of A in the merged result', () => {
    const a = createStack('GRASS', 10)
    const b = createStack('GRASS', 5)
    const [newA] = mergeStacks(a, b)
    expect(newA.blockType).toBe('GRASS')
  })

  it('should preserve blockType of B in the remainder', () => {
    const a = createStack('WOOD', 60)
    const b = createStack('WOOD', 10)
    const [, remainderB] = mergeStacks(a, b)
    expect(Option.isSome(remainderB)).toBe(true)
    expect(Option.getOrThrow(remainderB).blockType).toBe('WOOD')
  })

  it('should exactly fill A to MAX_STACK_SIZE and produce no remainder when fit is perfect (32 + 32)', () => {
    const a = createStack('STONE', 32)
    const b = createStack('STONE', 32)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(64)
    expect(Option.isNone(remainderB)).toBe(true)
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
    const stack = createStack('STONE', 10)
    const result = removeFromStack(stack, 10)
    expect(Option.isNone(result)).toBe(true)
  })

  it('should deplete stack when removing more than available (5 - 100 = none)', () => {
    const stack = createStack('DIRT', 5)
    const result = removeFromStack(stack, 100)
    expect(Option.isNone(result)).toBe(true)
  })

  it('should return some with count=1 when removing from stack of 2 (2 - 1 = 1)', () => {
    const stack = createStack('WOOD', 2)
    const result = removeFromStack(stack, 1)
    expect(Option.isSome(result)).toBe(true)
    const unwrapped = Option.getOrThrow(result)
    expect(unwrapped.count).toBe(1)
    expect(unwrapped.blockType).toBe('WOOD')
  })

  it('should return some with count=63 when removing 1 from full stack', () => {
    const stack = createStack('GRASS', 64)
    const result = removeFromStack(stack, 1)
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result).count).toBe(63)
  })

  it('should handle removing 0 items (partial: returns some with same count)', () => {
    const stack = createStack('STONE', 10)
    const result = removeFromStack(stack, 0)
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result).count).toBe(10)
  })
})

describe('mergeStacks edge cases', () => {
  it('should return unchanged A and B as some when types differ (DIRT vs STONE)', () => {
    const a = createStack('DIRT', 10)
    const b = createStack('STONE', 20)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(10)
    expect(newA.blockType).toBe('DIRT')
    expect(Option.isSome(remainderB)).toBe(true)
    const unwrapped = Option.getOrThrow(remainderB)
    expect(unwrapped.count).toBe(20)
    expect(unwrapped.blockType).toBe('STONE')
  })

  it('should return unchanged A and B as some when types differ (WOOD vs GLASS)', () => {
    const a = createStack('WOOD', 32)
    const b = createStack('GLASS', 16)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(32)
    expect(Option.isSome(remainderB)).toBe(true)
    expect(Option.getOrThrow(remainderB).count).toBe(16)
  })

  it('should handle merging into empty-like stack (1 + 63 = 64, no remainder)', () => {
    const a = createStack('STONE', 1)
    const b = createStack('STONE', 63)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(64)
    expect(Option.isNone(remainderB)).toBe(true)
  })

  it('should handle merging when both are full (64 + 64: A unchanged, B as remainder)', () => {
    const a = createStack('DIRT', 64)
    const b = createStack('DIRT', 64)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(64)
    expect(Option.isSome(remainderB)).toBe(true)
    expect(Option.getOrThrow(remainderB).count).toBe(64)
  })

  it('should handle merging B of count 1 into nearly full A (63 + 1 = 64)', () => {
    const a = createStack('SAND', 63)
    const b = createStack('SAND', 1)
    const [newA, remainderB] = mergeStacks(a, b)
    expect(newA.count).toBe(64)
    expect(Option.isNone(remainderB)).toBe(true)
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
    expect(() => Schema.decodeUnknownSync(ItemStack)({ blockType: 'BEDROCK', count: 1 })).toThrow()
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
