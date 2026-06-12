import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { TOOL_RECIPES } from '../application/recipes/tool-recipes'
import type { InventoryItem } from '@ts-minecraft/core'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const findById = (id: string) => TOOL_RECIPES.find((r) => r.id === id)

const ingredientTotal = (id: string): number => {
  const recipe = findById(id)
  if (!recipe) return 0
  return Arr.reduce(recipe.ingredients, 0, (sum, ing) => sum + ing.count)
}

const TOOL_TYPES = ['SWORD', 'PICKAXE', 'SHOVEL', 'HOE', 'AXE'] as const
const MATERIAL_TIERS = ['WOODEN', 'STONE', 'IRON', 'DIAMOND', 'GOLD'] as const

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('application/recipes/tool-recipes', () => {
  describe('structural invariants', () => {
    it('has no duplicate recipe IDs', () => {
      const ids = TOOL_RECIPES.map((r) => r.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(ids.length)
    })

    it('all recipes use crafting_table station', () => {
      for (const recipe of TOOL_RECIPES) {
        expect(recipe.station, `${recipe.id} should use crafting_table`).toBe('crafting_table')
      }
    })

    it('every recipe has at least one ingredient', () => {
      for (const recipe of TOOL_RECIPES) {
        expect(recipe.ingredients.length, `${recipe.id} has no ingredients`).toBeGreaterThanOrEqual(1)
      }
    })

    it('every recipe produces exactly 1 tool', () => {
      for (const recipe of TOOL_RECIPES) {
        expect(recipe.output.count, `${recipe.id} should produce count 1`).toBe(1)
      }
    })
  })

  describe('completeness: all four tool types exist for every material tier', () => {
    it('has 25 recipes total (5 types × 5 tiers)', () => {
      expect(TOOL_RECIPES.length).toBe(25)
    })

    it('all tier/type combinations have a recipe with correct output itemType', () => {
      for (const mat of MATERIAL_TIERS) {
        for (const toolType of TOOL_TYPES) {
          const outputItem = `${mat}_${toolType}` as InventoryItem
          const recipe = TOOL_RECIPES.find((r) => r.output.itemType === outputItem)
          expect(recipe, `missing recipe for ${outputItem}`).toBeDefined()
        }
      }
    })
  })

  describe('ingredient counts scale correctly with tool type', () => {
    it('swords require 2 head material + 1 stick (total 3)', () => {
      for (const mat of MATERIAL_TIERS) {
        const outputItem = `${mat}_SWORD` as InventoryItem
        const recipe = TOOL_RECIPES.find((r) => r.output.itemType === outputItem)!
        expect(ingredientTotal(recipe.id), `${outputItem} ingredient total`).toBe(3)
        const stickIng = recipe.ingredients.find((i) => i.itemType === 'STICKS')
        expect(stickIng?.count, `${outputItem} should need 1 stick`).toBe(1)
      }
    })

    it('pickaxes require 3 head material + 2 sticks (total 5)', () => {
      for (const mat of MATERIAL_TIERS) {
        const outputItem = `${mat}_PICKAXE` as InventoryItem
        const recipe = TOOL_RECIPES.find((r) => r.output.itemType === outputItem)!
        expect(ingredientTotal(recipe.id), `${outputItem} ingredient total`).toBe(5)
        const stickIng = recipe.ingredients.find((i) => i.itemType === 'STICKS')
        expect(stickIng?.count, `${outputItem} should need 2 sticks`).toBe(2)
      }
    })

    it('axes require 3 head material + 2 sticks (total 5)', () => {
      for (const mat of MATERIAL_TIERS) {
        const outputItem = `${mat}_AXE` as InventoryItem
        const recipe = TOOL_RECIPES.find((r) => r.output.itemType === outputItem)!
        expect(ingredientTotal(recipe.id), `${outputItem} ingredient total`).toBe(5)
        const stickIng = recipe.ingredients.find((i) => i.itemType === 'STICKS')
        expect(stickIng?.count, `${outputItem} should need 2 sticks`).toBe(2)
      }
    })

    it('shovels require 1 head material + 2 sticks (total 3)', () => {
      for (const mat of MATERIAL_TIERS) {
        const outputItem = `${mat}_SHOVEL` as InventoryItem
        const recipe = TOOL_RECIPES.find((r) => r.output.itemType === outputItem)!
        expect(ingredientTotal(recipe.id), `${outputItem} ingredient total`).toBe(3)
        const stickIng = recipe.ingredients.find((i) => i.itemType === 'STICKS')
        expect(stickIng?.count, `${outputItem} should need 2 sticks`).toBe(2)
      }
    })

    it('hoes require 2 head material + 2 sticks (total 4)', () => {
      for (const mat of MATERIAL_TIERS) {
        const outputItem = `${mat}_HOE` as InventoryItem
        const recipe = TOOL_RECIPES.find((r) => r.output.itemType === outputItem)!
        expect(ingredientTotal(recipe.id), `${outputItem} ingredient total`).toBe(4)
        const stickIng = recipe.ingredients.find((i) => i.itemType === 'STICKS')
        expect(stickIng?.count, `${outputItem} should need 2 sticks`).toBe(2)
      }
    })
  })

  describe('material ingredient matches tier', () => {
    it('WOODEN tools use PLANKS as head material', () => {
      for (const toolType of TOOL_TYPES) {
        const outputItem = `WOODEN_${toolType}` as InventoryItem
        const recipe = TOOL_RECIPES.find((r) => r.output.itemType === outputItem)!
        const headIng = recipe.ingredients.find((i) => i.itemType !== 'STICKS')
        expect(headIng?.itemType, `WOODEN_${toolType} should use PLANKS`).toBe('PLANKS')
      }
    })

    it('STONE tools use COBBLESTONE as head material', () => {
      for (const toolType of TOOL_TYPES) {
        const outputItem = `STONE_${toolType}` as InventoryItem
        const recipe = TOOL_RECIPES.find((r) => r.output.itemType === outputItem)!
        const headIng = recipe.ingredients.find((i) => i.itemType !== 'STICKS')
        expect(headIng?.itemType, `STONE_${toolType} should use COBBLESTONE`).toBe('COBBLESTONE')
      }
    })

    it('IRON tools use IRON_INGOT as head material', () => {
      for (const toolType of TOOL_TYPES) {
        const outputItem = `IRON_${toolType}` as InventoryItem
        const recipe = TOOL_RECIPES.find((r) => r.output.itemType === outputItem)!
        const headIng = recipe.ingredients.find((i) => i.itemType !== 'STICKS')
        expect(headIng?.itemType, `IRON_${toolType} should use IRON_INGOT`).toBe('IRON_INGOT')
      }
    })

    it('GOLD tools use GOLD_INGOT as head material', () => {
      for (const toolType of TOOL_TYPES) {
        const outputItem = `GOLD_${toolType}` as InventoryItem
        const recipe = TOOL_RECIPES.find((r) => r.output.itemType === outputItem)!
        const headIng = recipe.ingredients.find((i) => i.itemType !== 'STICKS')
        expect(headIng?.itemType, `GOLD_${toolType} should use GOLD_INGOT`).toBe('GOLD_INGOT')
      }
    })

    it('DIAMOND tools use DIAMOND as head material', () => {
      for (const toolType of TOOL_TYPES) {
        const outputItem = `DIAMOND_${toolType}` as InventoryItem
        const recipe = TOOL_RECIPES.find((r) => r.output.itemType === outputItem)!
        const headIng = recipe.ingredients.find((i) => i.itemType !== 'STICKS')
        expect(headIng?.itemType, `DIAMOND_${toolType} should use DIAMOND`).toBe('DIAMOND')
      }
    })
  })
})
