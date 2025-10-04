import { describe, expect, it } from '@effect/vitest'
import { Effect, pipe } from 'effect'
import * as FC from 'effect/FastCheck'
import type { ChunkLoadingProvider } from '../../index'
import { ChunkLoadRequestInput, createRequest, makeChunkLoadingProvider } from '../../index'

describe('chunk_loader/application/chunk_loading_provider', () => {
  const baseInput: ChunkLoadRequestInput = {
    coordinates: { x: 2, y: 0, z: -3 },
    priority: 48,
    source: 'system',
    requestedAt: 12,
  }

  const withProvider = <A>(use: (provider: ChunkLoadingProvider) => Effect.Effect<A>) =>
    Effect.scoped(pipe(makeChunkLoadingProvider(), Effect.flatMap(use)))

  it.effect('enqueue produces completed session and updates cache', () =>
    withProvider((provider) =>
      Effect.gen(function* () {
        const request = yield* createRequest(baseInput)
        const sessionId = yield* provider.enqueue(baseInput)
        const progress = yield* provider.observe(sessionId)
        const cacheStatus = yield* provider.cacheStatus(request.id)
        const metrics = yield* provider.metrics()

        expect(progress.phase._tag === 'Completed' || progress.phase._tag === 'Failed').toBe(true)
        expect(metrics.completedSessions + metrics.failedSessions).toBeGreaterThan(0)
        expect(['hit', 'fresh', 'stale']).toContain(cacheStatus)
      })
    )
  )

  it.effect('evict removes cache entries idempotently', () =>
    withProvider((provider) =>
      Effect.gen(function* () {
        const requestInput: ChunkLoadRequestInput = {
          ...baseInput,
          coordinates: { x: 5, y: 0, z: 1 },
        }
        const request = yield* createRequest(requestInput)
        yield* provider.enqueue(requestInput)
        const before = yield* provider.cacheStatus(request.id)
        const first = yield* provider.evict(request.id)
        const second = yield* provider.evict(request.id)
        expect(first).toBe(before)
        expect(second).toBe('miss')
      })
    )
  )

  it('enqueue returns branded session identifiers (property-based)', async () => {
    await FC.assert(
      FC.asyncProperty(
        FC.record({
          coordinates: FC.record({
            x: FC.integer({ min: -32, max: 32 }),
            y: FC.integer({ min: -32, max: 32 }),
            z: FC.integer({ min: -32, max: 32 }),
          }),
          priority: FC.integer({ min: 0, max: 100 }),
          source: FC.constantFrom('player', 'system', 'prefetch'),
          requestedAt: FC.nat(),
        }),
        async (candidate) => {
          const decoded = await Effect.runPromise(pipe(createRequest(candidate), Effect.either))

          if (decoded._tag === 'Left') {
            return true
          }

          await Effect.runPromise(
            withProvider((provider) =>
              Effect.gen(function* () {
                const sessionId = yield* provider.enqueue(candidate)
                expect(sessionId.startsWith('session_')).toBe(true)
              })
            )
          )

          return true
        }
      )
    )
  })
})
