import { Context, Effect, Layer, Option, Ref, pipe } from 'effect'
import { PlayerErrorBuilders } from './errors'
import type { PlayerAggregate, PlayerId } from './types'

export interface PlayerRepositoryService {
  readonly upsert: (aggregate: PlayerAggregate) => Effect.Effect<void, never>
  readonly findById: (id: PlayerId) => Effect.Effect<PlayerAggregate, ReturnType<typeof PlayerErrorBuilders.missing>>
  readonly remove: (id: PlayerId) => Effect.Effect<boolean, ReturnType<typeof PlayerErrorBuilders.missing>>
  readonly list: Effect.Effect<ReadonlyArray<PlayerAggregate>, never>
  readonly exists: (id: PlayerId) => Effect.Effect<boolean, never>
}

export const PlayerRepository = Context.Tag<PlayerRepositoryService>('@domain/player/repository')

const makeRepository = Effect.gen(function* () {
  const store = yield* Ref.make<Map<PlayerId, PlayerAggregate>>(new Map())

  const upsert: PlayerRepositoryService['upsert'] = (aggregate) =>
    Ref.update(store, (current) => {
      const next = new Map(current)
      next.set(aggregate.id, aggregate)
      return next
    })

  const findById: PlayerRepositoryService['findById'] = (id) =>
    pipe(
      Ref.get(store),
      Effect.map((map) => map.get(id)),
      Effect.flatMap((maybeAggregate) =>
        pipe(
          Option.fromNullable(maybeAggregate),
          Option.match({
            onNone: () => Effect.fail(PlayerErrorBuilders.missing('PlayerAggregate', id)),
            onSome: (aggregate) => Effect.succeed(aggregate),
          })
        )
      )
    )

  const remove: PlayerRepositoryService['remove'] = (id) =>
    pipe(
      findById(id),
      Effect.flatMap(() =>
        Ref.modify(store, (current) => {
          const next = new Map(current)
          const deleted = next.delete(id)
          return [deleted, next] as const
        })
      ),
      Effect.mapError((error) => error)
    )

  const list: PlayerRepositoryService['list'] = pipe(
    Ref.get(store),
    Effect.map((map) => Array.from(map.values()))
  )

  const exists: PlayerRepositoryService['exists'] = (id) =>
    pipe(
      Ref.get(store),
      Effect.map((map) => map.has(id))
    )

  return {
    upsert,
    findById,
    remove,
    list,
    exists,
  } satisfies PlayerRepositoryService
})

export const PlayerRepositoryLive = Layer.effect(PlayerRepository, makeRepository)
