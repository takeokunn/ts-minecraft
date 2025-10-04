import { describe, expect, it } from '@effect/vitest'
import * as FC from 'effect/FastCheck'
import { Effect, Match, Option, Schema, pipe } from 'effect'
import {
  CacheStatusSchema,
  LoadPhase,
  cacheStatusFallback,
  createRequest,
  normalizePriority,
  progressFromPhase,
  ChunkLoadRequestInput,
} from '../../types/interfaces'

const expectedProgress = (phase: LoadPhase): number =>
  pipe(
    Match.value(phase._tag),
    Match.when('Queued', () => 0),
    Match.when('Fetching', () => 0.25),
    Match.when('Processing', () => 0.5),
    Match.when('Caching', () => 0.75),
    Match.when('Completed', () => 1),
    Match.when('Failed', () => 1),
    Match.exhaustive
  )

describe('chunk_loader/types/interfaces', () => {
  it.effect('createRequest succeeds with well-formed input', () =>
    Effect.gen(function* () {
      const input: ChunkLoadRequestInput = {
        coordinates: { x: 4, y: 0, z: -2 },
        priority: 72,
        source: 'player',
        requestedAt: 10,
      }

      const request = yield* createRequest(input)
      expect(request.id.startsWith('chunk_')).toBe(true)
      expect(request.priority).toBeGreaterThanOrEqual(0)
    })
  )

  it.effect('createRequest reports validation failure for invalid priority', () =>
    Effect.gen(function* () {
      const input: ChunkLoadRequestInput = {
        coordinates: { x: 1, y: 0, z: 1 },
        priority: 220,
        source: 'system',
        requestedAt: 5,
      }

      const outcome = yield* pipe(createRequest(input), Effect.either)
      expect(outcome._tag).toBe('Left')
      if (outcome._tag === 'Left') {
        expect(outcome.left._tag).toBe('ValidationError')
      }
    })
  )

  it.effect('progressFromPhase produces monotonic progress', () =>
    Effect.forEach(
      [
        LoadPhase.Queued(),
        LoadPhase.Fetching({ stage: 'network' }),
        LoadPhase.Processing({ stage: 'meshing' }),
        LoadPhase.Caching(),
        LoadPhase.Completed({ cacheHit: true }),
        LoadPhase.Failed({ reason: 'x' }),
      ] as const,
      (phase) =>
        pipe(
          progressFromPhase(phase),
          Effect.map((value) => expect(value).toBe(expectedProgress(phase)))
        )
    )
  )

  it('cacheStatusFallback returns miss when option empty', () => {
    const status = cacheStatusFallback(Option.none())
    const parsed = Schema.decodeUnknownEither(CacheStatusSchema)(status)
    expect(parsed._tag).toBe('Right')
    expect(status).toBe('miss')
  })

  it('normalizePriority satisfies priority bounds (property-based)', async () => {
    await FC.assert(
      FC.asyncProperty(FC.float({ min: 0, max: 100, noNaN: true }), async (value) => {
        const normalized = await Effect.runPromise(normalizePriority(value))
        expect(normalized >= 0 && normalized <= 100).toBe(true)
      })
    )
  })
})
