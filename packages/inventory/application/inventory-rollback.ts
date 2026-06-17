import { Effect, Option } from 'effect'
import type { InventoryService } from './inventory-service'

export const tryInventoryRollbackTransaction = <Failure>(
  inventoryService: Pick<InventoryService, 'serialize' | 'deserialize'>,
  action: Effect.Effect<void, Failure>,
): Effect.Effect<Option.Option<Failure>, never> =>
  Effect.gen(function* () {
    const snapshot = yield* inventoryService.serialize()

    return yield* action.pipe(
      Effect.map(() => Option.none<Failure>()),
      Effect.catchAll((failure: Failure) =>
        Effect.gen(function* () {
          yield* inventoryService.deserialize(snapshot)
          return Option.some(failure)
        }),
      ),
    )
  })
