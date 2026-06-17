import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, HashMap, Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import { RecipeId } from '@ts-minecraft/core'
import { RECIPE_DEFINITIONS } from './recipes'
import {
  buildRecipeMap,
  canUseRecipe,
  countAvailableItems,
  findInsufficientIngredient,
} from './recipe-service-state'
import {
  tryCraftRecipeItems,
} from './recipe-service-helpers'

const makeCraftInventory = (
  initial: ReadonlyArray<readonly [InventoryItem, number]>,
  options?: {
    readonly failOnRemove?: InventoryItem
    readonly failOnAdd?: InventoryItem
  },
) => {
  let counts = new Map<InventoryItem, number>(initial)

  const getCount = (itemType: InventoryItem): number => counts.get(itemType) ?? 0

  return {
    getCount,
    service: {
      serialize: () =>
        Effect.sync(() => Array.from(counts.entries()) as ReadonlyArray<readonly [InventoryItem, number]>),
      deserialize: (snapshot: ReadonlyArray<readonly [InventoryItem, number]>) =>
        Effect.sync(() => {
          counts = new Map(snapshot)
        }),
      removeBlock: (itemType: InventoryItem, count: number) =>
        Effect.suspend(() => {
          if (options?.failOnRemove === itemType) {
            return Effect.fail(new Error(`remove failed for ${itemType}`))
          }

          const current = getCount(itemType)
          if (current < count) {
            return Effect.fail(new Error(`insufficient ${itemType}`))
          }

          counts.set(itemType, current - count)
          return Effect.void
        }),
      addBlock: (itemType: InventoryItem, count: number) =>
        Effect.suspend(() => {
          if (options?.failOnAdd === itemType) {
            return Effect.fail(new Error(`add failed for ${itemType}`))
          }

          counts.set(itemType, getCount(itemType) + count)
          return Effect.void
        }),
    },
  }
}

describe('recipe-service state and helper utilities', () => {
  it('counts item totals across slots and ignores empty slots', () => {
    const slots = [
      Option.some({ itemType: 'WOOD' as InventoryItem, count: 2, durability: 0, enchantments: [] }),
      Option.none(),
      Option.some({ itemType: 'WOOD' as InventoryItem, count: 3, durability: 0, enchantments: [] }),
      Option.some({ itemType: 'STONE' as InventoryItem, count: 1, durability: 0, enchantments: [] }),
    ]

    const available = countAvailableItems(slots)

    expect(HashMap.get(available, 'WOOD' as InventoryItem)).toEqual(Option.some(5))
    expect(HashMap.get(available, 'STONE' as InventoryItem)).toEqual(Option.some(1))
    expect(HashMap.get(available, 'PLANKS' as InventoryItem)).toEqual(Option.none())
  })

  it('finds the first ingredient that is short on stock', () => {
    const available = HashMap.make(
      ['WOOD' as InventoryItem, 1],
      ['STICKS' as InventoryItem, 1],
    )
    const recipe = RECIPE_DEFINITIONS.find((item) => item.id === RecipeId.make('planks-and-sticks-to-wooden-sword'))
    if (!recipe) {
      expect.fail('expected recipe to exist')
    }

    const shortage = findInsufficientIngredient(available, recipe.ingredients)

    expect(Option.getOrNull(shortage)?.itemType).toBe('PLANKS')
  })

  it('only allows recipes at stations the player can actually use', () => {
    const craftingTableRecipe = RECIPE_DEFINITIONS.find((item) => item.id === RecipeId.make('planks-and-sticks-to-wooden-sword'))
    const furnaceRecipe = RECIPE_DEFINITIONS.find((item) => item.id === RecipeId.make('raw-iron-to-iron-ingot'))

    if (!craftingTableRecipe || !furnaceRecipe) {
      expect.fail('expected recipes to exist')
    }

    expect(canUseRecipe(craftingTableRecipe, true, true)).toBe(true)
    expect(canUseRecipe(craftingTableRecipe, false, true)).toBe(false)
    expect(canUseRecipe(furnaceRecipe, true, true)).toBe(true)
    expect(canUseRecipe(furnaceRecipe, true, false)).toBe(false)
  })

  it('builds a lookup map keyed by recipe id', () => {
    const map = buildRecipeMap(RECIPE_DEFINITIONS)

    expect(Option.isSome(HashMap.get(map, RecipeId.make('wood-to-planks')))).toBe(true)
    expect(Option.isNone(HashMap.get(map, RecipeId.make('nonexistent-recipe')))).toBe(true)
  })

  it.effect('craft helper succeeds and mutates inventory when all steps succeed', () =>
    Effect.gen(function* () {
      const recipe = RECIPE_DEFINITIONS.find((item) => item.id === RecipeId.make('wood-to-planks'))
      if (!recipe) {
        expect.fail('expected recipe to exist')
      }

      const inventory = makeCraftInventory([
        ['WOOD' as InventoryItem, 1],
      ])

      const failure = yield* tryCraftRecipeItems(inventory.service, recipe)

      expect(Option.isNone(failure)).toBe(true)
      expect(inventory.getCount('WOOD' as InventoryItem)).toBe(0)
      expect(inventory.getCount('PLANKS' as InventoryItem)).toBe(4)
    }))

  it.effect('craft helper rolls back and reports failure when ingredient removal fails', () =>
    Effect.gen(function* () {
      const recipe = RECIPE_DEFINITIONS.find((item) => item.id === RecipeId.make('planks-to-sticks'))
      if (!recipe) {
        expect.fail('expected recipe to exist')
      }

      const inventory = makeCraftInventory(
        [
          ['PLANKS' as InventoryItem, 1],
        ],
        { failOnRemove: 'PLANKS' as InventoryItem },
      )

      const failure = yield* tryCraftRecipeItems(inventory.service, recipe)

      expect(Option.isSome(failure)).toBe(true)
      expect(Option.getOrThrow(failure).cause).toContain('Failed to remove')
      expect(inventory.getCount('PLANKS' as InventoryItem)).toBe(1)
      expect(inventory.getCount('STICKS' as InventoryItem)).toBe(0)
    }))

  it.effect('craft helper rolls back and reports failure when output addition fails', () =>
    Effect.gen(function* () {
      const recipe = RECIPE_DEFINITIONS.find((item) => item.id === RecipeId.make('planks-to-sticks'))
      if (!recipe) {
        expect.fail('expected recipe to exist')
      }

      const inventory = makeCraftInventory(
        [
          ['PLANKS' as InventoryItem, 2],
        ],
        { failOnAdd: 'STICKS' as InventoryItem },
      )

      const failure = yield* tryCraftRecipeItems(inventory.service, recipe)

      expect(Option.isSome(failure)).toBe(true)
      expect(Option.getOrThrow(failure).cause).toContain('No space for output')
      expect(inventory.getCount('PLANKS' as InventoryItem)).toBe(2)
      expect(inventory.getCount('STICKS' as InventoryItem)).toBe(0)
    }))
})
