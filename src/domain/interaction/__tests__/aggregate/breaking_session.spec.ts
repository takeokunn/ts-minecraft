import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { completeImmediately, createSession, recordProgress } from '../../aggregate/breaking_session'
import { decodeSessionId } from '../../types'
import { fromNormalVector } from '../../value_object/block_face'
import { fromNumbers } from '../../value_object/vector3'

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

  it('progress never exceeds completion (PBT)', () =>
    fc.assert(
      fc.property(fc.array(fc.float({ min: 0, max: 1, noDefaultInfinity: true }), { maxLength: 6 }), (deltas) => {
        let session = Effect.runSync(makeSession(4_000 + deltas.length))
        let timestamp = 4_001

        for (const delta of deltas) {
          if (session.state._tag === 'Completed') {
            const exit = Effect.runSyncExit(recordProgress(session, delta, timestamp++))
            expect(exit._tag).toBe('Failure')
            break
          }

          const result = Effect.runSync(recordProgress(session, delta, timestamp++))
          session = result.session

          if (session.state._tag === 'InProgress') {
            expect(Number(session.state.progress)).toBeGreaterThanOrEqual(0)
            expect(Number(session.state.progress)).toBeLessThanOrEqual(1)
          } else {
            expect(session.state._tag).toBe('Completed')
          }
        }

        if (session.state._tag === 'InProgress') {
          expect(Number(session.state.progress)).toBeLessThanOrEqual(1)
        }
      }),
      { numRuns: 48 }
    )
  )
})
