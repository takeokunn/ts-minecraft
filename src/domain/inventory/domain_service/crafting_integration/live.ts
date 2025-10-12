/**
 * Crafting Integration Service Live Implementation
 *
 * クラフティング統合ドメインサービスの純粋なドメインロジック実装。
 * インベントリとクラフティングシステムの統合を効率的に処理します。
 */

import { Effect, Layer, Option, pipe, ReadonlyArray } from 'effect'
import type { Inventory, ItemId, ItemStack } from '../../types'
import { makeUnsafeItemId } from '../../value_object/item_id/types'
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
        // 材料の可用性をチェック
        const ingredientChecks = yield* pipe(
          recipe.ingredients,
          Effect.forEach(
            (ingredient) =>
              Effect.gen(function* () {
                const available = yield* countItemsInInventory(inventory, ingredient.itemId)
                return {
                  ingredient,
                  available,
                  isMissing: available < ingredient.count,
                }
              }),
            { concurrency: 4 }
          )
        )

        const missingIngredients = pipe(
          ingredientChecks,
          ReadonlyArray.filter((check) => check.isMissing),
          ReadonlyArray.map((check) => ({
            itemId: check.ingredient.itemId,
            required: check.ingredient.count,
            available: check.available,
          }))
        )

        const canCraftIngredients = missingIngredients.length === 0

        // 結果の配置可能性をチェック
        const resultPlacement = yield* checkResultPlacement(inventory, recipe.result)

        const canCraft = canCraftIngredients && resultPlacement.canPlace

        const reason = !canCraftIngredients
          ? resultPlacement.canPlace
            ? 'Insufficient ingredients'
            : 'Insufficient ingredients; No space for result'
          : !resultPlacement.canPlace
            ? 'No space for result'
            : undefined

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

        // Effect.filterOrFailによる検証
        yield* Effect.succeed(craftability).pipe(
          Effect.filterOrFail(
            (c) => c.canCraft,
            () => new CraftingIntegrationError('CANNOT_CRAFT', craftability.reason)
          )
        )

        // Effect.replicateとEffect.reduceによるクラフト実行
        const craftingResults = yield* pipe(
          Effect.replicate(craftCount, Effect.unit),
          Effect.reduce(
            {
              currentInventory: inventory,
              craftedItems: [] as const satisfies readonly ItemStack[],
              consumedIngredients: [] as const satisfies CraftingResult['consumedIngredients'],
              experienceGained: 0,
            },
            (acc, _) =>
              Effect.gen(function* () {
                // 材料を消費
                const consumption = yield* consumeIngredients(acc.currentInventory, recipe.ingredients)

                // 結果アイテムを追加
                const resultStack: ItemStack = {
                  itemId: recipe.result.itemId,
                  count: recipe.result.count,
                  metadata: recipe.result.metadata,
                }

                const addResult = yield* addItemToInventory(consumption.updatedInventory, resultStack)

                return {
                  currentInventory: addResult.updatedInventory,
                  craftedItems: [...acc.craftedItems, resultStack],
                  consumedIngredients: [...acc.consumedIngredients, ...consumption.consumed],
                  experienceGained: acc.experienceGained + (recipe.requirements.experience ?? 0),
                }
              })
          )
        )

        return {
          success: true,
          updatedInventory: craftingResults.currentInventory,
          craftedItems: craftingResults.craftedItems,
          consumedIngredients: craftingResults.consumedIngredients,
          experienceGained: craftingResults.experienceGained,
          byproducts: [],
        }
      }),

    /**
     * 材料の自動収集
     */
    collectIngredients: (inventory, ingredients, allowAlternatives = false) =>
      Effect.gen(function* () {
        return yield* pipe(
          ingredients,
          Effect.reduce(
            {
              collected: [] as const satisfies IngredientCollectionResult['collected'],
              missing: [] as const satisfies IngredientCollectionResult['missing'],
              alternatives: [] as const satisfies IngredientCollectionResult['alternatives'],
            },
            (acc, ingredient) =>
              Effect.gen(function* () {
                const availableSlots = yield* findItemSlots(inventory, ingredient.itemId)
                const totalAvailable = availableSlots.reduce(
                  (sum, slot) => sum + (inventory.slots[slot]?.count ?? 0),
                  0
                )

                // Match.whenによる材料十分性チェック
                return yield* pipe(
                  Match.value(totalAvailable >= ingredient.count),
                  Match.when(true, () =>
                    Effect.succeed({
                      ...acc,
                      collected: [
                        ...acc.collected,
                        {
                          itemId: ingredient.itemId,
                          count: ingredient.count,
                          fromSlots: availableSlots.slice(0, Math.ceil(ingredient.count / 64)),
                        },
                      ],
                    })
                  ),
                  Match.orElse(() =>
                    Effect.gen(function* () {
                      const newMissing = {
                        itemId: ingredient.itemId,
                        required: ingredient.count,
                        shortfall: ingredient.count - totalAvailable,
                      }

                      // Effect.whenによる代替材料検索
                      const newAlternatives = yield* Effect.when(allowAlternatives && !!ingredient.alternatives, {
                        onTrue: () =>
                          pipe(
                            ingredient.alternatives ?? [],
                            Effect.forEach(
                              (altItemId) =>
                                Effect.gen(function* () {
                                  const altAvailable = yield* countItemsInInventory(inventory, altItemId)
                                  return { altItemId, altAvailable }
                                }),
                              { concurrency: 4 }
                            ),
                            Effect.map(
                              ReadonlyArray.filterMap(({ altItemId, altAvailable }) =>
                                altAvailable > 0
                                  ? Option.some({
                                      originalItemId: ingredient.itemId,
                                      alternativeItemId: altItemId,
                                      availableCount: altAvailable,
                                    })
                                  : Option.none()
                              )
                            )
                          ),
                        onFalse: () => Effect.succeed([] as const satisfies IngredientCollectionResult['alternatives']),
                      })

                      return {
                        ...acc,
                        missing: [...acc.missing, newMissing],
                        alternatives: [...acc.alternatives, ...newAlternatives],
                      }
                    })
                  )
                )
              })
          )
        )
      }),

    /**
     * 代替材料の提案
     */
    suggestAlternativeIngredients: (inventory, requiredItemId, requiredCount) =>
      Effect.gen(function* () {
        // Effect.whenによる木材系代替材料検索
        const alternatives = yield* Effect.when(requiredItemId.includes('planks'), {
          onTrue: () =>
            pipe(
              ['oak', 'birch', 'spruce', 'jungle', 'acacia', 'dark_oak'] as const,
              Effect.forEach(
                (woodType) =>
                  Effect.gen(function* () {
                    const altItemId = makeUnsafeItemId(`minecraft:${woodType}_planks`)
                    const available = yield* countItemsInInventory(inventory, altItemId)
                    return { altItemId, available, woodType }
                  }),
                { concurrency: 4 }
              ),
              Effect.map(
                ReadonlyArray.filterMap(({ altItemId, available, woodType }) =>
                  altItemId !== requiredItemId && available > 0
                    ? Option.some({
                        itemId: altItemId,
                        availableCount: available,
                        compatibilityScore: 0.9,
                        reason: `Alternative wood type: ${woodType}`,
                      })
                    : Option.none()
                )
              )
            ),
          onFalse: () =>
            Effect.succeed(
              [] as const satisfies ReadonlyArray<{
                itemId: ItemId
                availableCount: number
                compatibilityScore: number
                reason: string
              }>
            ),
        })

        return alternatives.sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      }),

    /**
     * バッチクラフティング
     */
    batchCrafting: (inventory, recipes) =>
      Effect.gen(function* () {
        const sortedRecipes = yield* optimizeRecipeOrder(recipes)

        return yield* pipe(
          sortedRecipes,
          Effect.reduce(
            {
              currentInventory: inventory,
              totalCrafted: 0,
              totalExperienceGained: 0,
              failedRecipes: [] as const satisfies ReadonlyArray<{ recipe: Recipe; reason: string }>,
              executionOrder: [] as const satisfies readonly string[],
            },
            (acc, { recipe, count }) =>
              pipe(
                CraftingIntegrationService.executeCrafting(acc.currentInventory, recipe, count),
                Effect.map((result) => ({
                  currentInventory: result.updatedInventory,
                  totalCrafted: acc.totalCrafted + result.craftedItems.length,
                  totalExperienceGained: acc.totalExperienceGained + result.experienceGained,
                  failedRecipes: acc.failedRecipes,
                  executionOrder: [...acc.executionOrder, recipe.recipeId],
                })),
                Effect.catchAll((error) =>
                  Effect.succeed({
                    ...acc,
                    failedRecipes: [
                      ...acc.failedRecipes,
                      {
                        recipe,
                        reason: error instanceof Error ? error.message : 'Unknown error',
                      },
                    ],
                  })
                )
              )
          )
        )
      }),

    /**
     * 逆レシピ検索
     */
    findRecipesForItem: (targetItemId, inventory) =>
      Effect.gen(function* () {
        const allRecipes = yield* getAllRecipes()
        const matchingRecipes = allRecipes.filter((recipe) => recipe.result.itemId === targetItemId)

        const results = yield* pipe(
          matchingRecipes,
          Effect.forEach(
            (recipe) =>
              Effect.gen(function* () {
                const craftability = yield* CraftingIntegrationService.checkCraftability(inventory, recipe)

                return {
                  recipe,
                  canCraft: craftability.canCraft,
                  missingIngredients: craftability.missingIngredients.map((mi) => mi.itemId),
                  craftingComplexity: calculateCraftingComplexity(recipe),
                }
              }),
            { concurrency: 4 }
          )
        )

        const priority = (entry: { canCraft: boolean; craftingComplexity: number }) =>
          (entry.canCraft ? 0 : 1) * 1_000_000 + entry.craftingComplexity

        return results.sort((a, b) => priority(a) - priority(b))
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
  pipe(
    inventory.slots,
    ReadonlyArray.reduce(0, (count, slot) =>
      slot?.itemStack?.itemId === itemId ? count + slot.itemStack.count : count
    )
  )

const checkResultPlacement = (
  inventory: Inventory,
  result: { itemId: ItemId; count: number }
): Effect.Effect<CraftabilityResult['resultPlacement'], never> =>
  Effect.gen(function* () {
    // 空きスロットを検索
    const emptySlotIndex = pipe(
      inventory.slots,
      ReadonlyArray.findFirstIndex((slot) => slot === null)
    )

    // Option.matchによる空きスロットチェック
    return yield* pipe(
      emptySlotIndex,
      Option.match({
        onSome: (index) =>
          Effect.succeed({
            canPlace: true,
            targetSlot: index,
            overflow: [],
          }),
        onNone: () =>
          Effect.gen(function* () {
            // 同じアイテムで結合可能なスロットを検索
            const stackableSlotIndex = pipe(
              inventory.slots,
              ReadonlyArray.findFirstIndex(
                (slot) => slot?.itemStack?.itemId === result.itemId && slot.itemStack.count + result.count <= 64
              )
            )

            // Option.matchによるスタック可能チェック
            return yield* pipe(
              stackableSlotIndex,
              Option.match({
                onSome: (index) =>
                  Effect.succeed({
                    canPlace: true,
                    targetSlot: index,
                    overflow: [],
                  }),
                onNone: () =>
                  Effect.succeed({
                    canPlace: false,
                    overflow: [
                      {
                        itemId: result.itemId,
                        count: result.count,
                      },
                    ],
                  }),
              })
            )
          }),
      })
    )
  })

const calculateSuggestedSlots = (
  inventory: Inventory,
  ingredients: ReadonlyArray<RecipeIngredient>
): Effect.Effect<number[], never> =>
  Effect.gen(function* () {
    return yield* pipe(
      ingredients,
      Effect.forEach(
        (ingredient) =>
          Effect.gen(function* () {
            const slots = yield* findItemSlots(inventory, ingredient.itemId)
            return Option.fromNullable(slots[0])
          }),
        { concurrency: 4 }
      ),
      Effect.map(ReadonlyArray.getSomes)
    )
  })

const findItemSlots = (inventory: Inventory, itemId: ItemId): Effect.Effect<number[], never> =>
  Effect.succeed(
    pipe(
      inventory.slots,
      ReadonlyArray.reduceWithIndex([] as const satisfies readonly number[], (index, slots, slot) =>
        slot?.itemStack?.itemId === itemId ? [...slots, index] : slots
      )
    )
  )

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
  pipe(
    ingredients,
    Effect.reduce(
      {
        currentInventory: inventory,
        consumed: [] as const satisfies CraftingResult['consumedIngredients'],
      },
      (acc, ingredient) =>
        Effect.gen(function* () {
          const consumeResult = yield* consumeSpecificItem(acc.currentInventory, ingredient.itemId, ingredient.count)

          return {
            currentInventory: consumeResult.updatedInventory,
            consumed: [...acc.consumed, consumeResult.consumed],
          }
        })
    )
  )

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
    // Effect.reduceによるスロット走査
    const consumptionResult = yield* pipe(
      inventory.slots,
      ReadonlyArray.mapWithIndex((index, slot) => ({ index, slot })),
      Effect.reduce(
        {
          newSlots: [...inventory.slots],
          fromSlots: [] as const satisfies readonly number[],
          remainingToConsume: count,
        },
        (acc, { index, slot }) =>
          pipe(
            Match.value(acc.remainingToConsume === 0),
            Match.when(true, () => Effect.succeed(acc)),
            Match.orElse(() =>
              pipe(
                Option.fromNullable(slot?.itemStack),
                Option.filter((stack) => stack.itemId === itemId),
                Option.match({
                  onNone: () => Effect.succeed(acc),
                  onSome: (stack) => {
                    const consumeFromThisSlot = Math.min(stack.count, acc.remainingToConsume)

                    return pipe(
                      Match.value(consumeFromThisSlot === stack.count),
                      Match.when(true, () => Effect.succeed(null as typeof slot)),
                      Match.orElse(() =>
                        Effect.succeed({
                          ...slot,
                          itemStack: {
                            ...stack,
                            count: stack.count - consumeFromThisSlot,
                          },
                        })
                      ),
                      Effect.map((updatedSlot) => {
                        const newSlotsArray = [...acc.newSlots]
                        newSlotsArray[index] = updatedSlot

                        return {
                          newSlots: newSlotsArray,
                          fromSlots: [...acc.fromSlots, index],
                          remainingToConsume: acc.remainingToConsume - consumeFromThisSlot,
                        }
                      })
                    )
                  },
                })
              )
            )
          )
      )
    )

    // Effect.filterOrFailによる不足材料チェック
    yield* Effect.succeed(consumptionResult).pipe(
      Effect.filterOrFail(
        (result) => result.remainingToConsume === 0,
        (result) =>
          new CraftingIntegrationError('INSUFFICIENT_MATERIALS', `Missing ${result.remainingToConsume} ${itemId}`)
      )
    )

    return {
      updatedInventory: {
        ...inventory,
        slots: consumptionResult.newSlots,
      },
      consumed: {
        itemId,
        count,
        fromSlots: consumptionResult.fromSlots,
      },
    }
  })

const addItemToInventory = (
  inventory: Inventory,
  item: ItemStack
): Effect.Effect<{ updatedInventory: Inventory }, CraftingIntegrationError> =>
  Effect.gen(function* () {
    // ReadonlyArray.findFirstIndexによる空きスロット検索
    const emptySlotIndex = pipe(
      inventory.slots,
      ReadonlyArray.findFirstIndex((slot) => slot === null)
    )

    // Option.matchによる空きスロットチェック
    return yield* pipe(
      emptySlotIndex,
      Option.match({
        onSome: (index) =>
          Effect.gen(function* () {
            const newSlots = [...inventory.slots]
            newSlots[index] = item
            return {
              updatedInventory: {
                ...inventory,
                slots: newSlots,
              },
            }
          }),
        onNone: () => Effect.fail(new CraftingIntegrationError('INVENTORY_FULL', 'No space to place crafted item')),
      })
    )
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
        ingredients: [{ itemId: makeUnsafeItemId('minecraft:wheat'), count: 3 }],
        result: {
          itemId: makeUnsafeItemId('minecraft:bread'),
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
  const baseComplexity = recipe.ingredients.length
  const craftingTableBonus = recipe.requirements.craftingTableRequired ? 1 : 0
  const furnaceBonus = recipe.requirements.furnaceRequired ? 2 : 0
  const brewingStandBonus = recipe.requirements.brewingStandRequired ? 2 : 0
  const smithingTableBonus = recipe.requirements.smithingTableRequired ? 3 : 0

  return baseComplexity + craftingTableBonus + furnaceBonus + brewingStandBonus + smithingTableBonus
}
