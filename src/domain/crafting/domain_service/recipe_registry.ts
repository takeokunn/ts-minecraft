import { RecipeAggregate } from '@/domain/crafting/aggregate'
import { RecipeId } from '@/domain/crafting/types'
import { Array, Context, Effect, Layer, Option, Ref, pipe } from 'effect'

export interface RecipeRegistryService {
  readonly put: (aggregate: RecipeAggregate) => Effect.Effect<void, never>
  readonly get: (id: RecipeId) => Effect.Effect<Option.Option<RecipeAggregate>, never>
  readonly remove: (id: RecipeId) => Effect.Effect<void, never>
  readonly list: () => Effect.Effect<ReadonlyArray<RecipeAggregate>, never>
}

export const RecipeRegistryService = Context.GenericTag<RecipeRegistryService>(
  '@minecraft/domain/crafting/RecipeRegistryService'
)

export const RecipeRegistryServiceLive = Layer.scoped(
  RecipeRegistryService,
  Effect.gen(function* () {
    const store = yield* Ref.make<ReadonlyArray<RecipeAggregate>>([])

    const put: RecipeRegistryService['put'] = (aggregate) =>
      Ref.update(store, (current) =>
        pipe(
          current,
          Array.filter((entry) => entry.id !== aggregate.id),
          (filtered) => [...filtered, aggregate]
        )
      )

    const get: RecipeRegistryService['get'] = (id) =>
      pipe(
        Ref.get(store),
        Effect.map((entries) => Array.findFirst(entries, (entry) => entry.id === id))
      )

    const remove: RecipeRegistryService['remove'] = (id) =>
      Ref.update(store, (current) => current.filter((entry) => entry.id !== id))

    const list: RecipeRegistryService['list'] = () => Ref.get(store)

    return {
      put,
      get,
      remove,
      list,
    }
  })
)
