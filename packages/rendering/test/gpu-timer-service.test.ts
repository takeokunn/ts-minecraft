import { describe, it } from '@effect/vitest'
import { expect, vi, beforeEach, afterEach } from 'vitest'
import { Array as Arr, Effect, MutableRef } from 'effect'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Test plan
// ---------------------------------------------------------------------------
// 1. Disabled path (vitest node env → window absent → isPerfEnabled() === false):
//    - markGpuRange returns the inner effect unchanged (reference equality).
//    - poll resolves with no-op.
//    - getSnapshot returns an empty Map.
//    - attach is a silent no-op.
// 2. Extension-absent path (perf flag mocked true, gl.getExtension returns null):
//    - service stays in no-op mode after attach (markGpuRange is pass-through).
// 3. Active path (perf flag mocked true, mocked WebGL2 context with extension):
//    - markGpuRange issues beginQuery/endQuery and enqueues the query.
//    - poll drains completed queries and produces a snapshot entry (ms = ns/1e6).
//    - rolling-average window is honored.
//    - GPU_DISJOINT_EXT=true causes samples to be discarded.
//    - scope teardown calls deleteQuery() for every in-flight query.
// ---------------------------------------------------------------------------

// We must import via the package alias just like perf-marks.test.ts to verify
// re-exports. For active-path tests we additionally need to mutate the
// `isPerfEnabled` flag, which we do with vi.mock + factory.

// ---------------------------------------------------------------------------
// Disabled-path tests (isPerfEnabled() naturally returns false in node env)
// ---------------------------------------------------------------------------

describe('GpuTimerService — disabled path (node env)', () => {
  it('markGpuRange returns the inner effect unchanged (reference equality)', async () => {
    const { GpuTimerService } = await import('@ts-minecraft/rendering')
    const inner = Effect.succeed(123)

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const timer = yield* GpuTimerService
          const wrapped = timer.markGpuRange('test:render', inner)
          // Reference equality — same contract as markEffect.
          expect(wrapped).toBe(inner)
          const value = yield* wrapped
          expect(value).toBe(123)
        }).pipe(Effect.provide(GpuTimerService.Default)),
      ),
    )
  })

  it('poll is a no-op (Effect.void)', async () => {
    const { GpuTimerService } = await import('@ts-minecraft/rendering')
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const timer = yield* GpuTimerService
          return yield* timer.poll()
        }).pipe(Effect.provide(GpuTimerService.Default)),
      ),
    )
    expect(result).toBeUndefined()
  })

  it('getSnapshot returns an empty Map', async () => {
    const { GpuTimerService } = await import('@ts-minecraft/rendering')
    const snapshot = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const timer = yield* GpuTimerService
          return yield* timer.getSnapshot()
        }).pipe(Effect.provide(GpuTimerService.Default)),
      ),
    )
    expect(snapshot.size).toBe(0)
  })

  it('attach is a silent no-op when perf is disabled', async () => {
    const { GpuTimerService } = await import('@ts-minecraft/rendering')
    const fakeRenderer = {
      getContext: () => null,
    } as unknown as THREE.WebGLRenderer

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const timer = yield* GpuTimerService
          return yield* timer.attach(fakeRenderer)
        }).pipe(Effect.provide(GpuTimerService.Default)),
      ),
    )
    expect(result).toBeUndefined()
  })

  it('exports GpuTimerServiceLive from the package barrel', async () => {
    const mod = await import('@ts-minecraft/rendering')
    expect(mod.GpuTimerServiceLive).toBeDefined()
    expect(typeof mod.GpuTimerServiceLive).toBe('object')
  })
})

// ---------------------------------------------------------------------------
// Active-path tests — mock isPerfEnabled and inject a fake WebGL2 context.
// ---------------------------------------------------------------------------

// The mock replaces ../../application/perf-flags at the source path used by
// gpu-timer-service.ts. We import the implementation file directly (not via
// the @ts-minecraft alias) so the relative-path mock applies.
vi.mock('@ts-minecraft/rendering/application/perf-flags', () => ({
  PERF_ENABLED: true,
  isPerfEnabled: () => true,
}))

// Helper to build a mock WebGL2 context with controllable query results.
type MockGl = {
  ctx: WebGL2RenderingContext
  // Test handles
  beginQueryCalls: Array<[number, WebGLQuery]>
  endQueryCalls: Array<number>
  deleteQueryCalls: Array<WebGLQuery>
  results: Map<WebGLQuery, { available: boolean; ns: number }>
  disjointRef: MutableRef.MutableRef<boolean>
  extensionEnabled: boolean
  // Set query result programmatically
  setResult: (q: WebGLQuery, ns: number) => void
  setDisjoint: (v: boolean) => void
}

const createMockGl = (extensionEnabled = true): MockGl => {
  const beginQueryCalls: Array<[number, WebGLQuery]> = []
  const endQueryCalls: Array<number> = []
  const deleteQueryCalls: Array<WebGLQuery> = []
  const results = new Map<WebGLQuery, { available: boolean; ns: number }>()
  const disjointRef = MutableRef.make(false)
  let queryCounter = 0

  const ctx = {
    createQuery: () => {
      queryCounter += 1
      const q = { __id: queryCounter } as unknown as WebGLQuery
      results.set(q, { available: false, ns: 0 })
      return q
    },
    beginQuery: (target: number, query: WebGLQuery) => {
      beginQueryCalls.push([target, query])
    },
    endQuery: (target: number) => {
      endQueryCalls.push(target)
    },
    deleteQuery: (query: WebGLQuery) => {
      deleteQueryCalls.push(query)
      results.delete(query)
    },
    getQueryParameter: (query: WebGLQuery, pname: number) => {
      const entry = results.get(query)
      // QUERY_RESULT_AVAILABLE_EXT
      if (pname === 0x8867) return entry?.available ?? false
      // QUERY_RESULT_EXT
      if (pname === 0x8866) return entry?.ns ?? 0
      return 0
    },
    getParameter: (pname: number) => {
      // GPU_DISJOINT_EXT
      if (pname === 0x8fbb) return MutableRef.get(disjointRef)
      return 0
    },
    getExtension: (name: string) => {
      if (name === 'EXT_disjoint_timer_query_webgl2' && extensionEnabled) {
        return {} // truthy sentinel — entry points are on ctx itself
      }
      return null
    },
  } as unknown as WebGL2RenderingContext

  return {
    ctx,
    beginQueryCalls,
    endQueryCalls,
    deleteQueryCalls,
    results,
    disjointRef,
    extensionEnabled,
    setResult: (q: WebGLQuery, ns: number) => {
      results.set(q, { available: true, ns })
    },
    setDisjoint: (v: boolean) => {
      MutableRef.set(disjointRef, v)
    },
  }
}

const makeFakeRenderer = (gl: WebGL2RenderingContext | null): THREE.WebGLRenderer =>
  ({
    getContext: () => gl,
  }) as unknown as THREE.WebGLRenderer

describe('GpuTimerService — active path (perf enabled, mocked WebGL2)', () => {
  let mod: typeof import('../infrastructure/perf/gpu-timer-service')
  beforeEach(async () => {
    vi.resetModules()
    mod = await import('../infrastructure/perf/gpu-timer-service')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to no-op when the extension is unavailable', async () => {
    const mock = createMockGl(false)
    const renderer = makeFakeRenderer(mock.ctx)
    const inner = Effect.succeed('payload')
    await Effect.runPromise(
      Effect.scoped(Effect.gen(function* () {
        const timer = yield* mod.GpuTimerService
        yield* timer.attach(renderer)
        const wrapped = timer.markGpuRange('foo', inner)
        expect(wrapped).toBe(inner)
        yield* wrapped
      }).pipe(Effect.provide(mod.GpuTimerService.Default))),
    )
    expect(mock.beginQueryCalls).toHaveLength(0)
    expect(mock.endQueryCalls).toHaveLength(0)
  })

  it('falls back to no-op when getContext returns null', async () => {
    const renderer = makeFakeRenderer(null)
    const inner = Effect.succeed(7)
    await Effect.runPromise(
      Effect.scoped(Effect.gen(function* () {
        const timer = yield* mod.GpuTimerService
        yield* timer.attach(renderer)
        const wrapped = timer.markGpuRange('foo', inner)
        expect(wrapped).toBe(inner)
      }).pipe(Effect.provide(mod.GpuTimerService.Default))),
    )
  })

  it('issues begin/end query pairs around the wrapped effect', async () => {
    const mock = createMockGl()
    const renderer = makeFakeRenderer(mock.ctx)
    await Effect.runPromise(
      Effect.scoped(Effect.gen(function* () {
        const timer = yield* mod.GpuTimerService
        yield* timer.attach(renderer)
        yield* timer.markGpuRange('terrain', Effect.succeed('inner'))
        yield* timer.markGpuRange('water', Effect.succeed('inner'))
      }).pipe(Effect.provide(mod.GpuTimerService.Default))),
    )
    expect(mock.beginQueryCalls).toHaveLength(2)
    expect(mock.endQueryCalls).toHaveLength(2)
    expect(mock.beginQueryCalls[0]?.[0]).toBe(0x88bf)
    expect(mock.endQueryCalls[0]).toBe(0x88bf)
  })

  it('poll drains completed queries and updates getSnapshot', async () => {
    const mock = createMockGl()
    const renderer = makeFakeRenderer(mock.ctx)
    const snapshot = await Effect.runPromise(
      Effect.scoped(Effect.gen(function* () {
        const timer = yield* mod.GpuTimerService
        yield* timer.attach(renderer)
        yield* timer.markGpuRange('shadow', Effect.succeed(null))
        yield* timer.markGpuRange('shadow', Effect.succeed(null))
        const queries = Array.from(mock.results.keys())
        mock.setResult(queries[0]!, 2_000_000)
        mock.setResult(queries[1]!, 4_000_000)
        yield* timer.poll()
        return yield* timer.getSnapshot()
      }).pipe(Effect.provide(mod.GpuTimerService.Default))),
    )
    expect(snapshot.get('shadow')).toBeCloseTo(3.0, 5)
    expect(mock.deleteQueryCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('discards samples when GPU_DISJOINT_EXT is true', async () => {
    const mock = createMockGl()
    const renderer = makeFakeRenderer(mock.ctx)
    const snapshot = await Effect.runPromise(
      Effect.scoped(Effect.gen(function* () {
        const timer = yield* mod.GpuTimerService
        yield* timer.attach(renderer)
        yield* timer.markGpuRange('disjoint-test', Effect.succeed(null))
        const queries = Array.from(mock.results.keys())
        mock.setResult(queries[0]!, 1_000_000)
        mock.setDisjoint(true)
        yield* timer.poll()
        return yield* timer.getSnapshot()
      }).pipe(Effect.provide(mod.GpuTimerService.Default))),
    )
    expect(snapshot.has('disjoint-test')).toBe(false)
  })

  it('rolling average is capped at 10 samples', async () => {
    const mock = createMockGl()
    const renderer = makeFakeRenderer(mock.ctx)
    const snapshot = await Effect.runPromise(
      Effect.scoped(Effect.gen(function* () {
        const timer = yield* mod.GpuTimerService
        yield* timer.attach(renderer)
        yield* Effect.forEach(
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          () => timer.markGpuRange('rolling', Effect.succeed(null)),
          { concurrency: 1 },
        )
        const queries = Array.from(mock.results.keys())
        Arr.forEach(queries, (q, i) => mock.setResult(q, (i + 1) * 1_000_000))
        yield* timer.poll()
        return yield* timer.getSnapshot()
      }).pipe(Effect.provide(mod.GpuTimerService.Default))),
    )
    expect(snapshot.get('rolling')).toBeCloseTo(7.5, 5)
  })

  it('stops draining at the first incomplete query (FIFO ordering)', async () => {
    const mock = createMockGl()
    const renderer = makeFakeRenderer(mock.ctx)
    const snapshot = await Effect.runPromise(
      Effect.scoped(Effect.gen(function* () {
        const timer = yield* mod.GpuTimerService
        yield* timer.attach(renderer)
        yield* timer.markGpuRange('a', Effect.succeed(null))
        yield* timer.markGpuRange('a', Effect.succeed(null))
        const queries = Array.from(mock.results.keys())
        mock.setResult(queries[0]!, 5_000_000)
        yield* timer.poll()
        return yield* timer.getSnapshot()
      }).pipe(Effect.provide(mod.GpuTimerService.Default))),
    )
    expect(snapshot.get('a')).toBeCloseTo(5.0, 5)
  })

  it('releases all in-flight queries on scope teardown', async () => {
    const mock = createMockGl()
    const renderer = makeFakeRenderer(mock.ctx)
    await Effect.runPromise(
      Effect.scoped(Effect.gen(function* () {
        const timer = yield* mod.GpuTimerService
        yield* timer.attach(renderer)
        yield* timer.markGpuRange('leak-check-1', Effect.succeed(null))
        yield* timer.markGpuRange('leak-check-2', Effect.succeed(null))
      }).pipe(Effect.provide(mod.GpuTimerService.Default))),
    )
    expect(mock.deleteQueryCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('attach is idempotent — second call does not re-bind', async () => {
    const mock = createMockGl()
    const renderer = makeFakeRenderer(mock.ctx)
    await Effect.runPromise(
      Effect.scoped(Effect.gen(function* () {
        const timer = yield* mod.GpuTimerService
        yield* timer.attach(renderer)
        yield* timer.attach(renderer)
        yield* timer.markGpuRange('idem', Effect.succeed(null))
      }).pipe(Effect.provide(mod.GpuTimerService.Default))),
    )
    expect(mock.beginQueryCalls).toHaveLength(1)
    expect(mock.endQueryCalls).toHaveLength(1)
  })
})
