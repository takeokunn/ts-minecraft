import { describe, expect, it } from 'vitest'
import { Effect, MutableRef } from 'effect'
import { PerfHudService, installPerfHudCounters } from '@ts-minecraft/rendering'
import type { ChunkCountProvider } from '@ts-minecraft/rendering'

// In vitest node environment, `window` is undefined.
// isPerfDebugEnabled() returns false → PerfHudService always takes the no-op path.

describe('PerfHudService (node environment — no-op path)', () => {
  it('all methods return Effect.void when perf is disabled', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const hud = yield* PerfHudService
          yield* hud.recordFrame(0.016)
          yield* hud.setWorkerQueueDepth(5)
          yield* hud.setChunkCount(10)
          yield* hud.setDrawCalls(100)
        }).pipe(Effect.provide(PerfHudService.Default)),
      ),
    )
    // If we reach here without error, all methods returned Effect.void successfully.
  })

  it('recordFrame resolves without side-effects', async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const hud = yield* PerfHudService
          return yield* hud.recordFrame(0.033)
        }).pipe(Effect.provide(PerfHudService.Default)),
      ),
    )
    expect(result).toBeUndefined()
  })

  it('setChunkCount resolves without side-effects', async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const hud = yield* PerfHudService
          return yield* hud.setChunkCount(42)
        }).pipe(Effect.provide(PerfHudService.Default)),
      ),
    )
    expect(result).toBeUndefined()
  })
})

describe('installPerfHudCounters (node environment — no-op path)', () => {
  it('returns Effect.void immediately when perf is disabled', async () => {
    const mockChunkProvider: ChunkCountProvider = {
      getLoadedChunks: () => Effect.succeed([]),
    }
    const mockHud = {} as PerfHudService

    const effect = installPerfHudCounters(mockHud, mockChunkProvider, () => 0)
    // isPerfEnabled() is false in node → should resolve instantly with void
    const result = await Effect.runPromise(Effect.scoped(effect))
    expect(result).toBeUndefined()
  })

  it('does not call getLoadedChunks when perf is disabled', async () => {
    const calledRef = MutableRef.make(false)
    const mockChunkProvider: ChunkCountProvider = {
      getLoadedChunks: () => {
        MutableRef.set(calledRef, true)
        return Effect.succeed([])
      },
    }
    const mockHud = {} as PerfHudService

    await Effect.runPromise(Effect.scoped(installPerfHudCounters(mockHud, mockChunkProvider, () => 0)))
    expect(MutableRef.get(calledRef)).toBe(false)
  })
})
