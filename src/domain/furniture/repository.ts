import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Ref from 'effect/Ref'
import { pipe } from 'effect/Function'
import type { Furniture, FurnitureId } from './types.js'
import { FurnitureError } from './types.js'

export interface FurnitureRepository {
  readonly save: (entity: Furniture) => Effect.Effect<Furniture, never>
  readonly findById: (id: FurnitureId) => Effect.Effect<Furniture, FurnitureError>
  readonly delete: (id: FurnitureId) => Effect.Effect<void, FurnitureError>
  readonly list: (kind?: Furniture['_tag']) => Effect.Effect<ReadonlyArray<Furniture>, never>
  readonly transact: <A>(f: (items: ReadonlyArray<Furniture>) => A) => Effect.Effect<A, never>
}

const notFound = (id: FurnitureId) => FurnitureError.notFound(id)

export const createFurnitureRepository: Effect.Effect<FurnitureRepository> = Effect.gen(
  function* () {
    const store = yield* Ref.make<ReadonlyMap<FurnitureId, Furniture>>(new Map())

    const save: FurnitureRepository['save'] = (entity) =>
      pipe(
        Ref.update(store, (current) => new Map(current).set(entity.id, entity)),
        Effect.as(entity)
      )

    const findById: FurnitureRepository['findById'] = (id) =>
      pipe(
        Ref.get(store),
        Effect.flatMap((map) =>
          pipe(
            map.get(id),
            Option.fromNullable,
            Option.match({
              onNone: () => Effect.fail(notFound(id)),
              onSome: (value) => Effect.succeed(value),
            })
          )
        )
      )

    const deleteById: FurnitureRepository['delete'] = (id) =>
      pipe(
        Ref.get(store),
        Effect.flatMap((current) =>
          pipe(
            current.get(id),
            Option.fromNullable,
            Option.match({
              onNone: () => Effect.fail(notFound(id)),
              onSome: () =>
                pipe(
                  Ref.update(store, (previous) => {
                    const next = new Map(previous)
                    next.delete(id)
                    return next
                  }),
                  Effect.asVoid
                ),
            })
          )
        )
      )

    const list: FurnitureRepository['list'] = (kind) =>
      pipe(
        Ref.get(store),
        Effect.map((map) => {
          const values = Array.from(map.values())
          return pipe(
            Option.fromNullable(kind),
            Option.match({
              onNone: () => values,
              onSome: (tag) => values.filter((entity) => entity._tag === tag),
            })
          )
        })
      )

    const transact: FurnitureRepository['transact'] = (f) =>
      pipe(
        Ref.get(store),
        Effect.map((map) => f(Array.from(map.values())))
      )

    return { save, findById, delete: deleteById, list, transact }
  }
)
