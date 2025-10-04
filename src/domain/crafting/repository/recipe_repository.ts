import { Array, Context, Effect, Layer, Option, Ref, Schema, pipe } from 'effect'
import { RecipeAggregate } from '../aggregate/recipe'
import { RecipeId, RecipeIdSchema } from '../types'

export interface RecipeRepository {
  readonly save: (aggregate: RecipeAggregate) => Effect.Effect<void, never>
  readonly findById: (id: RecipeId) => Effect.Effect<Option.Option<RecipeAggregate>, never>
  readonly delete: (id: RecipeId) => Effect.Effect<void, never>
  readonly list: () => Effect.Effect<ReadonlyArray<RecipeAggregate>, never>
}

export const RecipeRepository = Context.GenericTag<RecipeRepository>(
  '@minecraft/domain/crafting/RecipeRepository'
)

export const RecipeRepositoryLive = Layer.scoped(
  RecipeRepository,
  Effect.gen(function* () {
    const state = yield* Ref.make<ReadonlyArray<RecipeAggregate>>([])

    const save: RecipeRepository['save'] = (aggregate) =>
      Ref.update(state, (current) =>
        pipe(
          current,
          Array.filter((entry) => entry.id !== aggregate.id),
          (filtered) => [...filtered, aggregate]
        )
      )

    const findById: RecipeRepository['findById'] = (id) =>
      pipe(
        Ref.get(state),
        Effect.map((entries) => Array.findFirst(entries, (entry) => entry.id === id))
      )

    const remove: RecipeRepository['delete'] = (id) =>
      Ref.update(state, (current) => current.filter((entry) => entry.id !== id))

    const list: RecipeRepository['list'] = () => Ref.get(state)

    return {
      save,
      findById,
      delete: remove,
      list,
    }
  })
)

export const decodeRecipeId = Schema.decodeEffect(RecipeIdSchema)
