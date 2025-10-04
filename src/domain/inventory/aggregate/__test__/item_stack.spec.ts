/**
 * @fileoverview ItemStackエンティティのテストスイート
 * DDD原則に基づくエンティティのビジネスロジックテスト
 */

import { Effect, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import type { ItemId } from '../../types.js'
import {
  ItemStackFactory,
  ItemStackFactoryLive,
  createDurableItemStack,
  createEnchantedItemStack,
  createSimpleItemStack,
} from '../item_stack/factory.js'
import {
  areItemStacksIdentical,
  canStackWith,
  consumeItemStack,
  damageItemStack,
  getMaxStackableQuantity,
  isBroken,
  isEnchanted,
  isFullDurability,
  mergeItemStacks,
  repairItemStack,
  splitItemStack,
} from '../item_stack/operations.js'
import type { Enchantment } from '../item_stack/types.js'

const testItemId = 'minecraft:diamond_sword' as ItemId
const testItemId2 = 'minecraft:stone' as ItemId

const testLayer = ItemStackFactoryLive

describe('ItemStack Entity', () => {
  describe('Factory', () => {
    it('should create simple item stack', async () => {
      const program = Effect.gen(function* () {
        const itemStack = yield* createSimpleItemStack(testItemId, 10)

        expect(itemStack.itemId).toBe(testItemId)
        expect(itemStack.count).toBe(10)
        expect(itemStack.version).toBe(1)
        expect(itemStack.id).toMatch(/^stack_/)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should create durable item stack', async () => {
      const program = Effect.gen(function* () {
        const itemStack = yield* createDurableItemStack(testItemId, 1, 0.8)

        expect(itemStack.durability).toBe(0.8)
        expect(itemStack.count).toBe(1)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should create enchanted item stack', async () => {
      const enchantments: ReadonlyArray<Enchantment> = [
        { id: 'sharpness', level: 5, description: 'Increases damage' },
        { id: 'unbreaking', level: 3, description: 'Increases durability' },
      ]

      const program = Effect.gen(function* () {
        const itemStack = yield* createEnchantedItemStack(testItemId, 1, enchantments)

        expect(itemStack.nbtData?.enchantments).toHaveLength(2)
        expect(itemStack.nbtData?.enchantments?.[0].id).toBe('sharpness')
        expect(itemStack.nbtData?.enchantments?.[0].level).toBe(5)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should fail to create with invalid stack size', async () => {
      const program = Effect.gen(function* () {
        return yield* createSimpleItemStack(testItemId, 0) // 無効なサイズ
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
      expect(result._tag).toBe('Failure')
    })

    it('should use builder pattern', async () => {
      const program = Effect.gen(function* () {
        const factory = yield* ItemStackFactory
        const itemStack = yield* factory
          .builder()
          .setItemId(testItemId)
          .setCount(5 as any)
          .setCustomName('Epic Sword')
          .addLore('A legendary weapon')
          .addTag('epic')
          .setUnbreakable(true)
          .build()

        expect(itemStack.nbtData?.customName).toBe('Epic Sword')
        expect(itemStack.nbtData?.lore).toContain('A legendary weapon')
        expect(itemStack.nbtData?.tags).toContain('epic')
        expect(itemStack.nbtData?.unbreakable).toBe(true)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })
  })

  describe('Operations', () => {
    describe('Merge Operations', () => {
      it('should merge compatible item stacks', async () => {
        const program = Effect.gen(function* () {
          const stack1 = yield* createSimpleItemStack(testItemId2, 10)
          const stack2 = yield* createSimpleItemStack(testItemId2, 15)

          const { mergedStack, event } = yield* mergeItemStacks(stack1, stack2)

          expect(mergedStack.count).toBe(25)
          expect(mergedStack.id).toBe(stack2.id) // ターゲットスタックのIDを維持
          expect(event.type).toBe('ItemStackMerged')
          expect(event.mergedQuantity).toBe(10)
          expect(event.finalQuantity).toBe(25)
        })

        const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
        expect(result).toBeUndefined()
      })

      it('should fail to merge incompatible item stacks', async () => {
        const program = Effect.gen(function* () {
          const stack1 = yield* createSimpleItemStack(testItemId, 10)
          const stack2 = yield* createSimpleItemStack(testItemId2, 15)

          return yield* mergeItemStacks(stack1, stack2)
        })

        const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
        expect(result._tag).toBe('Failure')
        if (result._tag === 'Failure') {
          expect(result.cause._tag).toBe('Fail')
          expect(result.cause.error.reason).toBe('INCOMPATIBLE_ITEMS')
        }
      })

      it('should fail to merge when exceeding stack size', async () => {
        const program = Effect.gen(function* () {
          const stack1 = yield* createSimpleItemStack(testItemId2, 40)
          const stack2 = yield* createSimpleItemStack(testItemId2, 30)

          return yield* mergeItemStacks(stack1, stack2) // 70 > 64
        })

        const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
        expect(result._tag).toBe('Failure')
        if (result._tag === 'Failure') {
          expect(result.cause._tag).toBe('Fail')
          expect(result.cause.error.reason).toBe('MERGE_OVERFLOW')
        }
      })
    })

    describe('Split Operations', () => {
      it('should split item stack', async () => {
        const program = Effect.gen(function* () {
          const originalStack = yield* createSimpleItemStack(testItemId2, 20)

          const { remainingStack, newStack, event } = yield* splitItemStack(originalStack, 8)

          expect(remainingStack.count).toBe(12)
          expect(remainingStack.id).toBe(originalStack.id) // 元のIDを維持
          expect(newStack.count).toBe(8)
          expect(newStack.id).not.toBe(originalStack.id) // 新しいID
          expect(newStack.itemId).toBe(originalStack.itemId) // 同じアイテムID
          expect(event.type).toBe('ItemStackSplit')
        })

        const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
        expect(result).toBeUndefined()
      })

      it('should fail to split with invalid quantity', async () => {
        const program = Effect.gen(function* () {
          const stack = yield* createSimpleItemStack(testItemId2, 10)

          return yield* splitItemStack(stack, 0) // 無効な分割数量
        })

        const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
        expect(result._tag).toBe('Failure')
      })

      it('should fail to split when quantity equals or exceeds total', async () => {
        const program = Effect.gen(function* () {
          const stack = yield* createSimpleItemStack(testItemId2, 10)

          return yield* splitItemStack(stack, 10) // 全量分割は無効
        })

        const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
        expect(result._tag).toBe('Failure')
      })
    })

    describe('Consume Operations', () => {
      it('should consume partial item stack', async () => {
        const program = Effect.gen(function* () {
          const stack = yield* createSimpleItemStack(testItemId2, 10)

          const { updatedStack, event } = yield* consumeItemStack(stack, 3, 'used')

          expect(Option.isSome(updatedStack)).toBe(true)
          if (Option.isSome(updatedStack)) {
            expect(updatedStack.value.count).toBe(7)
          }
          expect(event.type).toBe('ItemStackConsumed')
          expect(event.consumedQuantity).toBe(3)
          expect(event.reason).toBe('used')
        })

        const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
        expect(result).toBeUndefined()
      })

      it('should consume entire item stack', async () => {
        const program = Effect.gen(function* () {
          const stack = yield* createSimpleItemStack(testItemId2, 5)

          const { updatedStack, event } = yield* consumeItemStack(stack, 5, 'crafted')

          expect(Option.isNone(updatedStack)).toBe(true)
          expect(event.remainingQuantity).toBe(0)
        })

        const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
        expect(result).toBeUndefined()
      })

      it('should fail to consume more than available', async () => {
        const program = Effect.gen(function* () {
          const stack = yield* createSimpleItemStack(testItemId2, 5)

          return yield* consumeItemStack(stack, 10, 'used')
        })

        const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
        expect(result._tag).toBe('Failure')
      })
    })

    describe('Durability Operations', () => {
      it('should damage item stack', async () => {
        const program = Effect.gen(function* () {
          const stack = yield* createDurableItemStack(testItemId, 1, 1.0)

          const { updatedStack, event } = yield* damageItemStack(stack, 0.2)

          expect(Option.isSome(updatedStack)).toBe(true)
          if (Option.isSome(updatedStack)) {
            expect(updatedStack.value.durability).toBe(0.8)
          }
          expect(event.type).toBe('ItemStackDamaged')
          expect(event.broken).toBe(false)
        })

        const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
        expect(result).toBeUndefined()
      })

      it('should break item when durability reaches zero', async () => {
        const program = Effect.gen(function* () {
          const stack = yield* createDurableItemStack(testItemId, 1, 0.1)

          const { updatedStack, event } = yield* damageItemStack(stack, 0.2)

          expect(Option.isNone(updatedStack)).toBe(true)
          expect(event.broken).toBe(true)
          expect(event.newDurability).toBe(0)
        })

        const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
        expect(result).toBeUndefined()
      })

      it('should repair item stack', async () => {
        const program = Effect.gen(function* () {
          const stack = yield* createDurableItemStack(testItemId, 1, 0.5)

          const repairedStack = yield* repairItemStack(stack, 0.3)

          expect(repairedStack.durability).toBe(0.8)
        })

        const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
        expect(result).toBeUndefined()
      })

      it('should cap repair at max durability', async () => {
        const program = Effect.gen(function* () {
          const stack = yield* createDurableItemStack(testItemId, 1, 0.9)

          const repairedStack = yield* repairItemStack(stack, 0.5)

          expect(repairedStack.durability).toBe(1.0) // 上限でキャップ
        })

        const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
        expect(result).toBeUndefined()
      })

      it('should fail to damage item without durability', async () => {
        const program = Effect.gen(function* () {
          const stack = yield* createSimpleItemStack(testItemId2, 10) // 耐久度なし

          return yield* damageItemStack(stack, 0.1)
        })

        const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
        expect(result._tag).toBe('Failure')
      })
    })
  })

  describe('Query Operations', () => {
    it('should check if item stacks are identical', async () => {
      const program = Effect.gen(function* () {
        const stack1 = yield* createSimpleItemStack(testItemId2, 10)
        const stack2 = yield* createSimpleItemStack(testItemId2, 10)
        const stack3 = yield* createSimpleItemStack(testItemId2, 5)

        expect(areItemStacksIdentical(stack1, stack2)).toBe(false) // 異なるID
        expect(areItemStacksIdentical(stack1, stack3)).toBe(false) // 異なる数量
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should check stack compatibility', async () => {
      const program = Effect.gen(function* () {
        const stack1 = yield* createSimpleItemStack(testItemId2, 10)
        const stack2 = yield* createSimpleItemStack(testItemId2, 15)
        const stack3 = yield* createSimpleItemStack(testItemId, 10)

        const canStack12 = yield* canStackWith(stack1, stack2)
        const canStack13 = yield* canStackWith(stack1, stack3)

        expect(canStack12).toBe(true) // 同じアイテムID
        expect(canStack13).toBe(false) // 異なるアイテムID
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should get max stackable quantity', async () => {
      const program = Effect.gen(function* () {
        const stack1 = yield* createSimpleItemStack(testItemId2, 10)
        const stack2 = yield* createSimpleItemStack(testItemId2, 50)

        const maxStackable = yield* getMaxStackableQuantity(stack1, stack2)

        expect(maxStackable).toBe(10) // min(10, 64-50) = min(10, 14) = 10
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should check item stack properties', async () => {
      const program = Effect.gen(function* () {
        const normalStack = yield* createSimpleItemStack(testItemId2, 10)
        const durableStack = yield* createDurableItemStack(testItemId, 1, 1.0)
        const brokenStack = yield* createDurableItemStack(testItemId, 1, 0.0)
        const enchantedStack = yield* createEnchantedItemStack(testItemId, 1, [{ id: 'sharpness', level: 5 }])

        expect(isBroken(normalStack)).toBe(false)
        expect(isBroken(durableStack)).toBe(false)
        expect(isBroken(brokenStack)).toBe(true)

        expect(isEnchanted(normalStack)).toBe(false)
        expect(isEnchanted(enchantedStack)).toBe(true)

        expect(isFullDurability(normalStack)).toBe(true) // 耐久度なし
        expect(isFullDurability(durableStack)).toBe(true)
        expect(isFullDurability(brokenStack)).toBe(false)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid damage amounts', async () => {
      const program = Effect.gen(function* () {
        const stack = yield* createDurableItemStack(testItemId, 1, 1.0)

        return yield* damageItemStack(stack, -0.1) // 負のダメージ
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
      expect(result._tag).toBe('Failure')
    })

    it('should handle invalid repair amounts', async () => {
      const program = Effect.gen(function* () {
        const stack = yield* createDurableItemStack(testItemId, 1, 0.5)

        return yield* repairItemStack(stack, -0.1) // 負の修復
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
      expect(result._tag).toBe('Failure')
    })

    it('should handle factory validation errors', async () => {
      const program = Effect.gen(function* () {
        const factory = yield* ItemStackFactory
        return yield* factory
          .builder()
          .setItemId(testItemId)
          .setCount(100 as any) // スタックサイズ上限超過
          .build()
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
      expect(result._tag).toBe('Failure')
    })
  })
})
