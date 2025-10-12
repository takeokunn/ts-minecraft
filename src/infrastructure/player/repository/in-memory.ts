import { Effect, Layer, Option, Ref, pipe } from 'effect'
import { PlayerRepository, type PlayerRepositoryService } from '@domain/player/repository'
import type { PlayerAggregate, PlayerId } from '@domain/player'
import { PlayerErrorBuilders } from '@domain/player'

const makeInMemoryRepository = Effect.gen(function* () {
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

export const PlayerRepositoryInMemoryLayer = Layer.effect(PlayerRepository, makeInMemoryRepository)
