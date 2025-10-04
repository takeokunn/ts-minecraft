import { describe, it, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect } from 'effect'
import {
  BreakingSession,
  BreakingSessionError,
  createSession,
  recordProgress,
  completeImmediately,
} from '../../aggregate/breaking-session'
import { decodeSessionId } from '../../types'
import { fromNumbers } from '../../value_object/vector3'
import { fromNormalVector } from '../../value_object/block-face'

const makeSession = (startedAt: number) =>
  Effect.gen(function* () {
    const id = yield* decodeSessionId(`session-${startedAt}`)
    const position = yield* fromNumbers(1, 1, 1)
    const face = yield* fromNormalVector(yield* fromNumbers(0, 0, 1))
    return yield* createSession({
      id,
      playerId: 'player-1',
      blockId: 'stone',
      face,
      origin: position,
      startedAt,
    })
  })

describe('breaking_session', () => {
  it.effect('creates a session with zero progress', () =>
    Effect.gen(function* () {
      const session = yield* makeSession(1_000)
      expect(session.state._tag).toBe('InProgress')
      if (session.state._tag === 'InProgress') {
        expect(Number(session.state.progress)).toBeCloseTo(0)
      }
    })
  )

  it.effect('records progress and emits events', () =>
    Effect.gen(function* () {
      const session = yield* makeSession(2_000)
      const result = yield* recordProgress(session, 0.4, 2_100)
      expect(result.session.state._tag).toBe('InProgress')
      expect(result.events).toHaveLength(1)
    })
  )

  it.effect('completes a session', () =>
    Effect.gen(function* () {
      const session = yield* makeSession(3_000)
      const result = yield* completeImmediately(session, 3_050)
      expect(result.session.state._tag).toBe('Completed')
      expect(result.events).toHaveLength(2)
    })
  )

  it.effect.prop('progress never exceeds completion', [fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 1, maxLength: 10 })], ([deltas]) =>
    Effect.gen(function* () {
      let session = yield* makeSession(4_000)
      let timestamp = 4_000

      for (const delta of deltas) {
        timestamp += 50
        const outcome = yield* recordProgress(session, delta, timestamp)
        session = outcome.session

        if (session.state._tag === 'InProgress') {
          expect(Number(session.state.progress)).toBeLessThanOrEqual(1)
        } else {
          expect(session.state._tag).toBe('Completed')
          break
        }
      }
    })
  )
})
