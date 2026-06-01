import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, MutableRef } from 'effect'
import { PerfHudService, computePercentiles, installPerfHudCounters } from '@ts-minecraft/rendering'
import type { ChunkCountProvider } from '@ts-minecraft/rendering'

const SAMPLE_BUFFER_SIZE = 120

describe('computePercentiles (perf-hud frame-time kernel)', () => {
  it('returns zero percentiles for an empty (un-warmed) buffer', () => {
    const ring = new Float64Array(SAMPLE_BUFFER_SIZE)
    const scratch = new Float64Array(SAMPLE_BUFFER_SIZE)
    expect(computePercentiles(ring, scratch, 0)).toEqual({ p50Ms: 0, p99Ms: 0 })
  })

  it('converts seconds to milliseconds (a single 16ms frame reads as 16ms)', () => {
    const ring = new Float64Array(SAMPLE_BUFFER_SIZE)
    const scratch = new Float64Array(SAMPLE_BUFFER_SIZE)
    ring[0] = 0.016 // 16 ms expressed in seconds
    const { p50Ms, p99Ms } = computePercentiles(ring, scratch, 1)
    expect(p50Ms).toBeCloseTo(16, 6)
    expect(p99Ms).toBeCloseTo(16, 6)
  })

  it('reads exact p50/p99 indices from a known 1..100ms distribution', () => {
    // Store 1..100 ms (as seconds) in order. validLength = 100.
    // p50Idx = floor(99 * 0.50) = 49 → 50th-smallest = 50 ms.
    // p99Idx = floor(99 * 0.99) = 98 → 99th-smallest = 99 ms.
    const ring = new Float64Array(SAMPLE_BUFFER_SIZE)
    const scratch = new Float64Array(SAMPLE_BUFFER_SIZE)
    for (let i = 0; i < 100; i++) ring[i] = (i + 1) / 1000
    const { p50Ms, p99Ms } = computePercentiles(ring, scratch, 100)
    expect(p50Ms).toBeCloseTo(50, 6)
    expect(p99Ms).toBeCloseTo(99, 6)
  })

  it('excludes the unfilled tail during warm-up (zeros must not skew percentiles)', () => {
    // Only 10 of 120 slots populated, all = 33 ms. The 110 trailing zeros
    // must be ignored — otherwise p50 would collapse toward 0.
    const ring = new Float64Array(SAMPLE_BUFFER_SIZE)
    const scratch = new Float64Array(SAMPLE_BUFFER_SIZE)
    for (let i = 0; i < 10; i++) ring[i] = 0.033
    const { p50Ms, p99Ms } = computePercentiles(ring, scratch, 10)
    expect(p50Ms).toBeCloseTo(33, 6)
    expect(p99Ms).toBeCloseTo(33, 6)
  })

  it('is order-independent — a scrambled (post-wrap) ring yields the same percentiles as sorted', () => {
    // After the circular buffer wraps, samples sit in arbitrary chronological
    // order. Percentiles must be invariant to that scrambling.
    const sortedRing = new Float64Array(SAMPLE_BUFFER_SIZE)
    const scrambledRing = new Float64Array(SAMPLE_BUFFER_SIZE)
    const scratch = new Float64Array(SAMPLE_BUFFER_SIZE)
    for (let i = 0; i < SAMPLE_BUFFER_SIZE; i++) sortedRing[i] = (i + 1) / 1000
    // Reverse order = a maximally scrambled permutation of the same multiset.
    for (let i = 0; i < SAMPLE_BUFFER_SIZE; i++) scrambledRing[i] = (SAMPLE_BUFFER_SIZE - i) / 1000
    expect(computePercentiles(scrambledRing, scratch, SAMPLE_BUFFER_SIZE))
      .toEqual(computePercentiles(sortedRing, scratch, SAMPLE_BUFFER_SIZE))
  })

  it('does not mutate the source ring buffer (sorting happens in scratch)', () => {
    const ring = new Float64Array(SAMPLE_BUFFER_SIZE)
    const scratch = new Float64Array(SAMPLE_BUFFER_SIZE)
    for (let i = 0; i < 5; i++) ring[i] = (5 - i) / 1000 // descending, unsorted
    const before = Array.from(ring)
    computePercentiles(ring, scratch, 5)
    expect(Array.from(ring)).toEqual(before)
  })
})

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
