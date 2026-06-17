import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { ARMOR_RECIPES } from '../application/recipes/armor-recipes'
import type { InventoryItem } from '@ts-minecraft/core'
import { ARMOR_SLOTS } from '../domain/armor'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const findById = (id: string) => ARMOR_RECIPES.find((r) => r.id === id)

const ingredientTotal = (id: string): number => {
  const recipe = findById(id)
  if (!recipe) return 0
  return Arr.reduce(recipe.ingredients, 0, (sum, ing) => sum + ing.count)
}

const ARMOR_TIERS = ['LEATHER', 'IRON', 'GOLD', 'DIAMOND'] as const

// Vanilla material counts per slot (matches standard Minecraft)
const VANILLA_MATERIAL_COUNTS: Record<string, number> = {
  HELMET: 5,
  CHESTPLATE: 8,
  LEGGINGS: 7,
  BOOTS: 4,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('application/recipes/armor-recipes', () => {
  describe('structural invariants', () => {
    it('has no duplicate recipe IDs', () => {
      const ids = ARMOR_RECIPES.map((r) => r.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(ids.length)
    })

    it('all recipes use crafting_table station', () => {
      for (const recipe of ARMOR_RECIPES) {
        expect(recipe.station, `${recipe.id} should use crafting_table`).toBe('crafting_table')
      }
    })

    it('every recipe has exactly one ingredient type', () => {
      for (const recipe of ARMOR_RECIPES) {
        expect(recipe.ingredients.length, `${recipe.id} should have 1 ingredient entry`).toBe(1)
      }
    })

    it('every recipe produces exactly 1 armor piece', () => {
      for (const recipe of ARMOR_RECIPES) {
        expect(recipe.output.count, `${recipe.id} should produce count 1`).toBe(1)
      }
    })
  })

  describe('completeness: 4 tiers × 4 slots = 16 recipes', () => {
    it('has exactly 16 recipes', () => {
      expect(ARMOR_RECIPES.length).toBe(16)
    })

    it('all tier/slot combinations produce a correctly named armor piece', () => {
      for (const tier of ARMOR_TIERS) {
        for (const slot of ARMOR_SLOTS) {
          const outputItem = `${tier}_${slot}` as InventoryItem
          const recipe = ARMOR_RECIPES.find((r) => r.output.itemType === outputItem)
          expect(recipe, `missing recipe for ${outputItem}`).toBeDefined()
        }
      }
    })
  })

  describe('material ingredient counts match vanilla values', () => {
    it('helmets require 5 material units', () => {
      for (const tier of ARMOR_TIERS) {
        const outputItem = `${tier}_HELMET` as InventoryItem
        const recipe = ARMOR_RECIPES.find((r) => r.output.itemType === outputItem)!
        expect(ingredientTotal(recipe.id), `${outputItem} count`).toBe(5)
      }
    })

    it('chestplates require 8 material units (most expensive)', () => {
      for (const tier of ARMOR_TIERS) {
        const outputItem = `${tier}_CHESTPLATE` as InventoryItem
        const recipe = ARMOR_RECIPES.find((r) => r.output.itemType === outputItem)!
        expect(ingredientTotal(recipe.id), `${outputItem} count`).toBe(8)
      }
    })

    it('leggings require 7 material units', () => {
      for (const tier of ARMOR_TIERS) {
        const outputItem = `${tier}_LEGGINGS` as InventoryItem
        const recipe = ARMOR_RECIPES.find((r) => r.output.itemType === outputItem)!
        expect(ingredientTotal(recipe.id), `${outputItem} count`).toBe(7)
      }
    })

    it('boots require 4 material units (cheapest)', () => {
      for (const tier of ARMOR_TIERS) {
        const outputItem = `${tier}_BOOTS` as InventoryItem
        const recipe = ARMOR_RECIPES.find((r) => r.output.itemType === outputItem)!
        expect(ingredientTotal(recipe.id), `${outputItem} count`).toBe(4)
      }
    })

    it('material cost is consistent across tiers for each slot', () => {
      for (const slot of ARMOR_SLOTS) {
        const counts = ARMOR_TIERS.map((tier) => {
          const outputItem = `${tier}_${slot}` as InventoryItem
          const recipe = ARMOR_RECIPES.find((r) => r.output.itemType === outputItem)!
          return ingredientTotal(recipe.id)
        })
        const allSame = counts.every((c) => c === counts[0])
        expect(allSame, `${slot} material count should be same across tiers`).toBe(true)
        expect(counts[0]).toBe(VANILLA_MATERIAL_COUNTS[slot])
      }
    })
  })

  describe('material ingredient matches tier', () => {
    it('LEATHER armor uses LEATHER as material', () => {
      for (const slot of ARMOR_SLOTS) {
        const outputItem = `LEATHER_${slot}` as InventoryItem
        const recipe = ARMOR_RECIPES.find((r) => r.output.itemType === outputItem)!
        expect(recipe.ingredients[0]!.itemType, `LEATHER_${slot} should use LEATHER`).toBe('LEATHER')
      }
    })

    it('IRON armor uses IRON_INGOT as material', () => {
      for (const slot of ARMOR_SLOTS) {
        const outputItem = `IRON_${slot}` as InventoryItem
        const recipe = ARMOR_RECIPES.find((r) => r.output.itemType === outputItem)!
        expect(recipe.ingredients[0]!.itemType, `IRON_${slot} should use IRON_INGOT`).toBe('IRON_INGOT')
      }
    })

    it('GOLD armor uses GOLD_INGOT as material', () => {
      for (const slot of ARMOR_SLOTS) {
        const outputItem = `GOLD_${slot}` as InventoryItem
        const recipe = ARMOR_RECIPES.find((r) => r.output.itemType === outputItem)!
        expect(recipe.ingredients[0]!.itemType, `GOLD_${slot} should use GOLD_INGOT`).toBe('GOLD_INGOT')
      }
    })

    it('DIAMOND armor uses DIAMOND as material', () => {
      for (const slot of ARMOR_SLOTS) {
        const outputItem = `DIAMOND_${slot}` as InventoryItem
        const recipe = ARMOR_RECIPES.find((r) => r.output.itemType === outputItem)!
        expect(recipe.ingredients[0]!.itemType, `DIAMOND_${slot} should use DIAMOND`).toBe('DIAMOND')
      }
    })
  })
})
