import { Effect, Option } from 'effect'
import type { Recipe } from '../domain/crafting'
import type { InventoryService } from './inventory-service'
import { tryInventoryRollbackTransaction } from './inventory-rollback'

export type RecipeCraftRollbackFailure = {
  readonly cause: string
}

export const tryCraftRecipeItems = (
  inventoryService: Pick<InventoryService, 'serialize' | 'deserialize' | 'removeBlock' | 'addBlock'>,
  recipe: Recipe,
): Effect.Effect<Option.Option<RecipeCraftRollbackFailure>, never> =>
  tryInventoryRollbackTransaction(
    inventoryService,
    Effect.gen(function* () {
      yield* Effect.forEach(
        recipe.ingredients,
        (ingredient) =>
          inventoryService.removeBlock(ingredient.itemType, ingredient.count).pipe(
            Effect.mapError(() => ({
              cause: `Failed to remove ${ingredient.count}x ${ingredient.itemType} from inventory`,
            })),
          ),
        { concurrency: 1 },
      )

      yield* inventoryService.addBlock(recipe.output.itemType, recipe.output.count).pipe(
        Effect.mapError(() => ({
          cause: `No space for output: ${recipe.output.count}x ${recipe.output.itemType}`,
        })),
      )
    }),
  )
