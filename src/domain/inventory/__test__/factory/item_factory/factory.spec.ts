import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { ItemFactoryLive } from '../../../factory/item_factory/factory'
import type { EnchantmentDefinition } from '../../../factory/item_factory/interface'
import { parseItemId } from '../../../types'

describe('ItemFactoryLive', () => {
  const decodeItemId = (value: string) => parseItemId(value)

  it.effect('createBasic applies defaults and requested count', () =>
    Effect.gen(function* () {
      const itemId = yield* decodeItemId('minecraft:stone')
      const stack = yield* ItemFactoryLive.createBasic(itemId, 4)

      expect(stack.itemId).toBe(itemId)
      expect(stack.count).toBe(4)
      expect(stack.metadata).toBeUndefined()
    })
  )

  it.effect('createWithConfig rejects invalid quantity', () =>
    Effect.gen(function* () {
      const itemId = yield* decodeItemId('minecraft:stone')
      const result = yield* Effect.either(
        ItemFactoryLive.createWithConfig({
          itemId,
          count: 0,
        })
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('ItemCreationError')
      }
    })
  )

  it.effect('addEnchantment detects conflicting enchantments', () =>
    Effect.gen(function* () {
      const itemId = yield* decodeItemId('minecraft:diamond_sword')
      const base = yield* ItemFactoryLive.createWeapon(itemId, 1)

      const sharpness: EnchantmentDefinition = {
        id: 'sharpness',
        name: 'Sharpness',
        level: 3,
        maxLevel: 5,
        description: 'Increases melee damage',
        conflictsWith: ['smite'],
      }

      const smite: EnchantmentDefinition = {
        id: 'smite',
        name: 'Smite',
        level: 1,
        maxLevel: 5,
        description: 'Increases undead damage',
        conflictsWith: ['sharpness'],
      }

      const equipped = yield* ItemFactoryLive.addEnchantment(base, sharpness)
      expect(equipped.metadata?.enchantments?.some((entry) => entry.id === 'sharpness')).toBe(true)

      const result = yield* Effect.either(ItemFactoryLive.addEnchantment(equipped, smite))
      expect(result._tag).toBe('Left')
    })
  )

  it.effect('splitStack preserves total item count', () =>
    Effect.sync(() =>
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 64 }),
          fc.integer({ min: 1, max: 63 }),
          async (total, amount) => {
            fc.pre(amount < total)

            const { remaining, split } = await Effect.runPromise(
              Effect.gen(function* () {
                const itemId = yield* decodeItemId('minecraft:cobblestone')
                const stack = yield* ItemFactoryLive.createBasic(itemId, total)
                const [rest, taken] = yield* ItemFactoryLive.splitStack(stack, amount)
                return { remaining: rest, split: taken }
              })
            )

            expect(remaining.count + split.count).toBe(total)
            expect(split.count).toBe(amount)
          }
        ),
        { verbose: false }
      )
    )
  )
})
