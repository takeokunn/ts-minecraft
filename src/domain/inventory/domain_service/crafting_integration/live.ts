/**
 * Crafting Integration Service Live Implementation
 *
 * クラフティング統合ドメインサービスの純粋なドメインロジック実装。
 * インベントリとクラフティングシステムの統合を効率的に処理します。
 */

import { Effect, Layer } from 'effect'
import type { Inventory, ItemId, ItemStack } from '../../types'
import {
  CraftingIntegrationError,
  CraftingIntegrationService,
  type CraftabilityResult,
  type CraftingResult,
  type IngredientCollectionResult,
  type Recipe,
  type RecipeIngredient,
} from './index'

/**
 * クラフティング統合サービスのLive実装
 */
export const CraftingIntegrationServiceLive = Layer.succeed(
  CraftingIntegrationService,
  CraftingIntegrationService.of({
    /**
     * レシピのクラフト可能性チェック
     */
    checkCraftability: (inventory, recipe) =>
      Effect.gen(function* () {
        const missingIngredients: CraftabilityResult['missingIngredients'] = []
        let canCraft = true
        let reason: string | undefined

        // 材料の可用性をチェック
        for (const ingredient of recipe.ingredients) {
          const available = yield* countItemsInInventory(inventory, ingredient.itemId)

          if (available < ingredient.count) {
            missingIngredients.push({
              itemId: ingredient.itemId,
              required: ingredient.count,
              available,
            })
            canCraft = false
          }
        }

        if (!canCraft) {
          reason = 'Insufficient ingredients'
        }

        // 結果の配置可能性をチェック
        const resultPlacement = yield* checkResultPlacement(inventory, recipe.result)

        if (!resultPlacement.canPlace) {
          canCraft = false
          reason = reason ? `${reason}; No space for result` : 'No space for result'
        }

        // 推奨スロットの計算
        const suggestedSlots = yield* calculateSuggestedSlots(inventory, recipe.ingredients)

        return {
          canCraft,
          reason,
          missingIngredients,
          suggestedSlots,
          resultPlacement,
        }
      }),

    /**
     * レシピのクラフト実行
     */
    executeCrafting: (inventory, recipe, craftCount = 1) =>
      Effect.gen(function* () {
        // クラフト可能性の事前チェック
        const craftability = yield* CraftingIntegrationService.checkCraftability(inventory, recipe)

        if (!craftability.canCraft) {
          yield* Effect.fail(new CraftingIntegrationError('CANNOT_CRAFT', craftability.reason))
        }

        let currentInventory = inventory
        const craftedItems: ItemStack[] = []
        const consumedIngredients: CraftingResult['consumedIngredients'] = []
        let experienceGained = 0

        // 指定された回数だけクラフトを実行
        for (let i = 0; i < craftCount; i++) {
          // 材料を消費
          const consumption = yield* consumeIngredients(currentInventory, recipe.ingredients)
          currentInventory = consumption.updatedInventory
          consumedIngredients.push(...consumption.consumed)

          // 結果アイテムを追加
          const resultStack: ItemStack = {
            itemId: recipe.result.itemId,
            count: recipe.result.count,
            metadata: recipe.result.metadata,
          }

          const addResult = yield* addItemToInventory(currentInventory, resultStack)
          currentInventory = addResult.updatedInventory
          craftedItems.push(resultStack)

          // 経験値を加算
          experienceGained += recipe.requirements.experience ?? 0
        }

        return {
          success: true,
          updatedInventory: currentInventory,
          craftedItems,
          consumedIngredients,
          experienceGained,
          byproducts: [], // 現在は副産物なし
        }
      }),

    /**
     * 材料の自動収集
     */
    collectIngredients: (inventory, ingredients, allowAlternatives = false) =>
      Effect.gen(function* () {
        const collected: IngredientCollectionResult['collected'] = []
        const missing: IngredientCollectionResult['missing'] = []
        const alternatives: IngredientCollectionResult['alternatives'] = []

        for (const ingredient of ingredients) {
          const availableSlots = yield* findItemSlots(inventory, ingredient.itemId)
          const totalAvailable = availableSlots.reduce((sum, slot) => sum + (inventory.slots[slot]?.count ?? 0), 0)

          if (totalAvailable >= ingredient.count) {
            // 十分な材料がある
            collected.push({
              itemId: ingredient.itemId,
              count: ingredient.count,
              fromSlots: availableSlots.slice(0, Math.ceil(ingredient.count / 64)),
            })
          } else {
            // 材料不足
            missing.push({
              itemId: ingredient.itemId,
              required: ingredient.count,
              shortfall: ingredient.count - totalAvailable,
            })

            // 代替材料を検索（許可されている場合）
            if (allowAlternatives && ingredient.alternatives) {
              for (const altItemId of ingredient.alternatives) {
                const altAvailable = yield* countItemsInInventory(inventory, altItemId)
                if (altAvailable > 0) {
                  alternatives.push({
                    originalItemId: ingredient.itemId,
                    alternativeItemId: altItemId,
                    availableCount: altAvailable,
                  })
                }
              }
            }
          }
        }

        return {
          collected,
          missing,
          alternatives,
        }
      }),

    /**
     * 代替材料の提案
     */
    suggestAlternativeIngredients: (inventory, requiredItemId, requiredCount) =>
      Effect.gen(function* () {
        // 簡単な代替材料ロジック（実際のゲームではより複雑）
        const alternatives: Array<{
          itemId: ItemId
          availableCount: number
          compatibilityScore: number
          reason: string
        }> = []

        // 木材系の代替
        if (requiredItemId.includes('planks')) {
          const woodTypes = ['oak', 'birch', 'spruce', 'jungle', 'acacia', 'dark_oak']

          for (const woodType of woodTypes) {
            const altItemId = `minecraft:${woodType}_planks` as ItemId
            if (altItemId !== requiredItemId) {
              const available = yield* countItemsInInventory(inventory, altItemId)
              if (available > 0) {
                alternatives.push({
                  itemId: altItemId,
                  availableCount: available,
                  compatibilityScore: 0.9,
                  reason: `Alternative wood type: ${woodType}`,
                })
              }
            }
          }
        }

        return alternatives.sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      }),

    /**
     * バッチクラフティング
     */
    batchCrafting: (inventory, recipes) =>
      Effect.gen(function* () {
        let currentInventory = inventory
        let totalCrafted = 0
        let totalExperienceGained = 0
        const failedRecipes: Array<{ recipe: Recipe; reason: string }> = []
        const executionOrder: string[] = []

        // レシピを効率的な順序で実行
        const sortedRecipes = yield* optimizeRecipeOrder(recipes)

        for (const { recipe, count } of sortedRecipes) {
          try {
            const result = yield* CraftingIntegrationService.executeCrafting(currentInventory, recipe, count)

            currentInventory = result.updatedInventory
            totalCrafted += result.craftedItems.length
            totalExperienceGained += result.experienceGained
            executionOrder.push(recipe.recipeId)
          } catch (error) {
            failedRecipes.push({
              recipe,
              reason: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }

        return {
          updatedInventory: currentInventory,
          totalCrafted,
          totalExperienceGained,
          failedRecipes,
          executionOrder,
        }
      }),

    /**
     * 逆レシピ検索
     */
    findRecipesForItem: (targetItemId, inventory) =>
      Effect.gen(function* () {
        // モックレシピデータベース（実際の実装ではレシピレジストリから取得）
        const allRecipes = yield* getAllRecipes()
        const matchingRecipes = allRecipes.filter((recipe) => recipe.result.itemId === targetItemId)

        const results: Array<{
          recipe: Recipe
          canCraft: boolean
          missingIngredients: ReadonlyArray<ItemId>
          craftingComplexity: number
        }> = []

        for (const recipe of matchingRecipes) {
          const craftability = yield* CraftingIntegrationService.checkCraftability(inventory, recipe)

          results.push({
            recipe,
            canCraft: craftability.canCraft,
            missingIngredients: craftability.missingIngredients.map((mi) => mi.itemId),
            craftingComplexity: calculateCraftingComplexity(recipe),
          })
        }

        return results.sort((a, b) => {
          // 実行可能なレシピを優先し、次に複雑度の低いものを優先
          if (a.canCraft && !b.canCraft) return -1
          if (!a.canCraft && b.canCraft) return 1
          return a.craftingComplexity - b.craftingComplexity
        })
      }),

    /**
     * クラフティング統計
     */
    getCraftingStats: () =>
      Effect.gen(function* () {
        // モック統計（実際の実装では永続化されたデータから取得）
        return {
          totalCrafts: 0,
          successfulCrafts: 0,
          failedCrafts: 0,
          averageCraftTime: 0,
          mostCraftedItem: null,
          totalExperienceGenerated: 0,
        }
      }),
  })
)

// =============================================================================
// Helper Functions
// =============================================================================

const countItemsInInventory = (inventory: Inventory, itemId: ItemId): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    let count = 0
    for (const slot of inventory.slots) {
      if (slot?.itemStack?.itemId === itemId) {
        count += slot.itemStack.count
      }
    }
    return count
  })

const checkResultPlacement = (
  inventory: Inventory,
  result: { itemId: ItemId; count: number }
): Effect.Effect<CraftabilityResult['resultPlacement'], never> =>
  Effect.gen(function* () {
    // 空きスロットを検索
    for (let i = 0; i < inventory.slots.length; i++) {
      if (inventory.slots[i] === null) {
        return {
          canPlace: true,
          targetSlot: i,
          overflow: [],
        }
      }
    }

    // 同じアイテムで結合可能なスロットを検索
    for (let i = 0; i < inventory.slots.length; i++) {
      const slot = inventory.slots[i]
      if (slot?.itemStack?.itemId === result.itemId && slot.itemStack.count + result.count <= 64) {
        return {
          canPlace: true,
          targetSlot: i,
          overflow: [],
        }
      }
    }

    return {
      canPlace: false,
      overflow: [
        {
          itemId: result.itemId,
          count: result.count,
        },
      ],
    }
  })

const calculateSuggestedSlots = (
  inventory: Inventory,
  ingredients: ReadonlyArray<RecipeIngredient>
): Effect.Effect<number[], never> =>
  Effect.gen(function* () {
    const suggestedSlots: number[] = []

    for (const ingredient of ingredients) {
      const slots = yield* findItemSlots(inventory, ingredient.itemId)
      if (slots.length > 0) {
        suggestedSlots.push(slots[0]) // 最初に見つかったスロットを提案
      }
    }

    return suggestedSlots
  })

const findItemSlots = (inventory: Inventory, itemId: ItemId): Effect.Effect<number[], never> =>
  Effect.gen(function* () {
    const slots: number[] = []

    for (let i = 0; i < inventory.slots.length; i++) {
      if (inventory.slots[i]?.itemStack?.itemId === itemId) {
        slots.push(i)
      }
    }

    return slots
  })

const consumeIngredients = (
  inventory: Inventory,
  ingredients: ReadonlyArray<RecipeIngredient>
): Effect.Effect<
  {
    updatedInventory: Inventory
    consumed: CraftingResult['consumedIngredients']
  },
  CraftingIntegrationError
> =>
  Effect.gen(function* () {
    let currentInventory = inventory
    const consumed: CraftingResult['consumedIngredients'] = []

    for (const ingredient of ingredients) {
      const consumeResult = yield* consumeSpecificItem(currentInventory, ingredient.itemId, ingredient.count)

      currentInventory = consumeResult.updatedInventory
      consumed.push(consumeResult.consumed)
    }

    return {
      updatedInventory: currentInventory,
      consumed,
    }
  })

const consumeSpecificItem = (
  inventory: Inventory,
  itemId: ItemId,
  count: number
): Effect.Effect<
  {
    updatedInventory: Inventory
    consumed: { itemId: ItemId; count: number; fromSlots: ReadonlyArray<number> }
  },
  CraftingIntegrationError
> =>
  Effect.gen(function* () {
    const newSlots = [...inventory.slots]
    const fromSlots: number[] = []
    let remainingToConsume = count

    for (let i = 0; i < newSlots.length && remainingToConsume > 0; i++) {
      const slot = newSlots[i]
      if (slot?.itemStack?.itemId === itemId) {
        const consumeFromThisSlot = Math.min(slot.itemStack.count, remainingToConsume)

        if (consumeFromThisSlot === slot.itemStack.count) {
          newSlots[i] = null
        } else {
          newSlots[i] = {
            ...slot,
            itemStack: {
              ...slot.itemStack,
              count: slot.itemStack.count - consumeFromThisSlot,
            },
          }
        }

        remainingToConsume -= consumeFromThisSlot
        fromSlots.push(i)
      }
    }

    if (remainingToConsume > 0) {
      yield* Effect.fail(
        new CraftingIntegrationError('INSUFFICIENT_MATERIALS', `Missing ${remainingToConsume} ${itemId}`)
      )
    }

    return {
      updatedInventory: {
        ...inventory,
        slots: newSlots,
      },
      consumed: {
        itemId,
        count,
        fromSlots,
      },
    }
  })

const addItemToInventory = (
  inventory: Inventory,
  item: ItemStack
): Effect.Effect<{ updatedInventory: Inventory }, CraftingIntegrationError> =>
  Effect.gen(function* () {
    const newSlots = [...inventory.slots]

    // 空きスロットを検索
    for (let i = 0; i < newSlots.length; i++) {
      if (newSlots[i] === null) {
        newSlots[i] = item
        return {
          updatedInventory: {
            ...inventory,
            slots: newSlots,
          },
        }
      }
    }

    yield* Effect.fail(new CraftingIntegrationError('INVENTORY_FULL', 'No space to place crafted item'))
  })

const optimizeRecipeOrder = (
  recipes: ReadonlyArray<{ recipe: Recipe; count: number }>
): Effect.Effect<ReadonlyArray<{ recipe: Recipe; count: number }>, never> =>
  Effect.gen(function* () {
    // 簡単な最適化：材料の少ないレシピから実行
    return [...recipes].sort((a, b) => a.recipe.ingredients.length - b.recipe.ingredients.length)
  })

const getAllRecipes = (): Effect.Effect<Recipe[], never> =>
  Effect.gen(function* () {
    // モックレシピデータ（実際の実装ではレシピレジストリから取得）
    return [
      {
        recipeId: 'bread_recipe',
        type: 'CRAFTING' as const,
        ingredients: [{ itemId: 'minecraft:wheat' as ItemId, count: 3 }],
        result: {
          itemId: 'minecraft:bread' as ItemId,
          count: 1,
        },
        requirements: {
          craftingTableRequired: false,
          furnaceRequired: false,
          brewingStandRequired: false,
          smithingTableRequired: false,
        },
      },
    ]
  })

const calculateCraftingComplexity = (recipe: Recipe): number => {
  // 複雑度の計算（材料数、特殊要件等を考慮）
  let complexity = recipe.ingredients.length

  if (recipe.requirements.craftingTableRequired) complexity += 1
  if (recipe.requirements.furnaceRequired) complexity += 2
  if (recipe.requirements.brewingStandRequired) complexity += 2
  if (recipe.requirements.smithingTableRequired) complexity += 3

  return complexity
}
