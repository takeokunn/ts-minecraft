import { Context, Effect, Layer, Option, Ref } from 'effect'
import { pipe } from 'effect/Function'
import { BreakingSession } from '../aggregate'
import { SessionId } from '../types'

export interface SessionStore {
  readonly get: (id: SessionId) => Effect.Effect<Option.Option<BreakingSession>>
  readonly save: (session: BreakingSession) => Effect.Effect<void>
  readonly remove: (id: SessionId) => Effect.Effect<void>
  readonly list: Effect.Effect<ReadonlyArray<BreakingSession>>
  readonly clear: Effect.Effect<void>
}

export const makeSessionStore = Effect.gen(function* () {
  const ref = yield* Ref.make<ReadonlyMap<SessionId, BreakingSession>>(new Map())

  const get: SessionStore['get'] = (id) =>
    pipe(
      Ref.get(ref),
      Effect.map((store) => Option.fromNullable(store.get(id)))
    )

  const save: SessionStore['save'] = (session) =>
    Ref.update(ref, (store) => {
      const next = new Map(store)
      next.set(session.id, session)
      return next
    })

  const remove: SessionStore['remove'] = (id) =>
    Ref.update(ref, (store) => {
      const next = new Map(store)
      next.delete(id)
      return next
    })

  const list: SessionStore['list'] = pipe(
    Ref.get(ref),
    Effect.map((store): ReadonlyArray<BreakingSession> => Array.from(store.values()))
  )

  const clear: SessionStore['clear'] = Ref.set(ref, new Map())

  return {
    get,
    save,
    remove,
    list,
    clear,
  } satisfies SessionStore
})

export const SessionStoreTag = Context.Tag<SessionStore>('@domain/interaction/SessionStore')

export const SessionStoreLive = Layer.effect(SessionStoreTag, makeSessionStore)
