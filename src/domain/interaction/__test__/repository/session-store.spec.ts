import { describe, it, expect } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import { Option } from 'effect'
import { makeSessionStore } from '../../repository/session-store'
import { createSession } from '../../aggregate/breaking-session'
import { decodeSessionId } from '../../types'
import { fromNumbers } from '../../value_object/vector3'
import { fromNormalVector } from '../../value_object/block-face'

describe('session_store', () => {
  const makeSession = (seed: number) =>
    Effect.gen(function* () {
      const id = yield* decodeSessionId(`session-${seed}`)
      const origin = yield* fromNumbers(0, 0, 0)
      const face = yield* fromNormalVector(yield* fromNumbers(0, 0, 1))
      return yield* createSession({
        id,
        playerId: 'player-1',
        blockId: 'stone',
        face,
        origin,
        startedAt: seed,
      })
    })

  it.effect('saves and retrieves sessions', () =>
    Effect.gen(function* () {
      const store = yield* makeSessionStore
      const session = yield* makeSession(1)
      yield* store.save(session)
      const fetched = yield* store.get(session.id)
      expect(Option.isSome(fetched)).toBe(true)
    })
  )

  it.effect('lists and clears sessions', () =>
    Effect.gen(function* () {
      const store = yield* makeSessionStore
      const session = yield* makeSession(2)
      yield* store.save(session)
      const listBefore = yield* store.list
      expect(listBefore.length).toBe(1)
      yield* store.clear
      const listAfter = yield* store.list
      expect(listAfter.length).toBe(0)
    })
  )
})
