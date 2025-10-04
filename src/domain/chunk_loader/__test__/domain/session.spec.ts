import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import {
  ChunkLoadRequestInput,
  LoadPhase,
  createRequest,
  makeSessionId,
  normalizeTimestamp,
  progressFromPhase,
} from '../../types/interfaces'
import { createSession, transition } from '../../domain/session'

const baseInput: ChunkLoadRequestInput = {
  coordinates: { x: 0, y: 0, z: 0 },
  priority: 64,
  source: 'player',
  requestedAt: 4,
}

describe('chunk_loader/domain/session', () => {
  it.effect('createSession yields queued state', () =>
    Effect.gen(function* () {
      const timestamp = yield* normalizeTimestamp(1000)
      const request = yield* createRequest(baseInput)
      const sessionId = yield* makeSessionId(timestamp, 'aaaaaaaaaaaaaaaa')
      const session = yield* createSession(sessionId, request, timestamp)
      expect(session.phase._tag).toBe('Queued')
      expect(session.progress).toBe(0)
    })
  )

  it.effect('transition enforces monotonic progress', () =>
    Effect.gen(function* () {
      const timestamp = yield* normalizeTimestamp(2000)
      const request = yield* createRequest(baseInput)
      const sessionId = yield* makeSessionId(timestamp, 'bbbbbbbbbbbbbbbb')
      const session = yield* createSession(sessionId, request, timestamp)
      const nextTime = yield* normalizeTimestamp(2001)
      const advanced = yield* transition(session, LoadPhase.Fetching({ stage: 'network' }), nextTime)
      const progress = yield* progressFromPhase(advanced.phase)
      expect(progress).toBeGreaterThan(session.progress)
    })
  )

  it.effect('transition to completion keeps cacheHit flag consistent', () =>
    Effect.gen(function* () {
      const timestamp = yield* normalizeTimestamp(3000)
      const request = yield* createRequest({ ...baseInput, source: 'prefetch' })
      const sessionId = yield* makeSessionId(timestamp, 'cccccccccccccccc')
      const session = yield* createSession(sessionId, request, timestamp)
      const cachingTime = yield* normalizeTimestamp(3001)
      const caching = yield* transition(session, LoadPhase.Caching(), cachingTime)
      const finalTime = yield* normalizeTimestamp(3002)
      const completed = yield* transition(caching, LoadPhase.Completed({ cacheHit: true }), finalTime)
      expect(completed.cacheHit).toBe(true)
      expect(completed.phase._tag).toBe('Completed')
    })
  )
})
