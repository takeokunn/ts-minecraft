import { Array, Context, Effect, Layer, Option, pipe } from 'effect'
import { RecipeAggregate } from '../aggregate/recipe'
import { ItemTag, RecipeId } from '../types'

export interface DiscoveryHint {
  readonly recipeId: RecipeId
  readonly missingTags: ReadonlyArray<ItemTag>
}

export interface RecipeDiscoveryService {
  readonly discoverable: (
    recipes: ReadonlyArray<RecipeAggregate>,
    ownedTags: ReadonlyArray<ItemTag>
  ) => Effect.Effect<ReadonlyArray<RecipeAggregate>, never>

  readonly hint: (
    recipe: RecipeAggregate,
    ownedTags: ReadonlyArray<ItemTag>
  ) => Effect.Effect<Option.Option<DiscoveryHint>, never>
}

export const RecipeDiscoveryService = Context.GenericTag<RecipeDiscoveryService>(
  '@minecraft/domain/crafting/RecipeDiscoveryService'
)

export const RecipeDiscoveryServiceLive = Layer.effect(
  RecipeDiscoveryService,
  Effect.succeed({
    discoverable: (recipes, ownedTags) =>
      Effect.succeed(
        pipe(
          recipes,
          Array.filter((recipe) =>
            pipe(
              recipe.metadata.tags,
              Array.every((tag) => ownedTags.includes(tag))
            )
          )
        )
      ),

    hint: (recipe, ownedTags) =>
      pipe(
        recipe.metadata.tags,
        Array.filter((tag) => !ownedTags.includes(tag)),
        (missing) =>
          missing.length === 0
            ? Effect.succeed(Option.none<DiscoveryHint>())
            : Effect.succeed(
                Option.some({
                  recipeId: recipe.id,
                  missingTags: missing,
                })
              )
      ),
  })
)
