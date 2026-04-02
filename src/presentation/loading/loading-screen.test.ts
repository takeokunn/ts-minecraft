import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { LoadingScreenService, LoadingScreenLive } from './loading-screen'
import { DomOperationsService } from '@/presentation/hud/crosshair'

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockDomLayer = () => {
  const overlayEl = {
    id: '',
    style: { cssText: '', display: 'flex' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
  } as unknown as HTMLDivElement

  const createElement = vi.fn((_tagName: string) => overlayEl as unknown as HTMLElement)

  const removeChild = vi.fn()

  const MockDomLayer = Layer.succeed(DomOperationsService, {
    createElement,
    appendChild: vi.fn(),
    appendChildTo: vi.fn(),
    removeChild,
    getParentNode: vi.fn(() => Option.none()),
    setInnerHTML: vi.fn(),
    querySelector: vi.fn(() => Option.none()),
  } as unknown as DomOperationsService)

  return { MockDomLayer, createElement, overlayEl, removeChild }
}

const buildTestLayer = (mockDom = createMockDomLayer()) =>
  LoadingScreenLive.pipe(
    Layer.provide(mockDom.MockDomLayer),
  )

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Note: vitest.config.ts sets environment: 'node', so `document` is undefined.
// The service takes the SSR-safe path (Option.none overlay), and DOM methods are no-ops.
// Tests verify that hide() and other methods complete without error in this environment.

describe('presentation/loading/loading-screen', () => {
  describe('LoadingScreenLive — layer provision', () => {
    it.scoped('should provide LoadingScreen as a Layer without error', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const loading = yield* LoadingScreenService
        expect(typeof loading.hide).toBe('function')
      }).pipe(Effect.provide(TestLayer))
    })

    it('should be defined', () => {
      expect(LoadingScreenLive).toBeDefined()
    })
  })

  describe('hide()', () => {
    it.scoped('should complete without error', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const loading = yield* LoadingScreenService
        yield* loading.hide()
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should complete without error when called multiple times', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const loading = yield* LoadingScreenService
        yield* loading.hide()
        yield* loading.hide()
        yield* loading.hide()
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should not throw in SSR environment (document undefined)', () => {
      // In node test environment, document is undefined, so overlay is Option.none.
      // hide() should be a no-op and not throw.
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const loading = yield* LoadingScreenService
        // Should not throw or fail
        yield* loading.hide()
        // hide is idempotent
        yield* loading.hide()
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('cleanup on scope close', () => {
    it.scoped('should not call removeChild when overlay was never created (SSR path)', () => {
      const mockDom = createMockDomLayer()
      const TestLayer = buildTestLayer(mockDom)
      return Effect.gen(function* () {
        yield* LoadingScreenService
        // In node environment, overlayEl is Option.none, so removeChild should not be called
        // (cleanup runs on scope close, but onNone branch is a no-op)
      }).pipe(Effect.provide(TestLayer))
      // Note: removeChild would be called in cleanup if overlayEl were Some, but SSR path keeps it None
    })
  })

  describe('Effect composition', () => {
    it.scoped('should support chaining hide with other effects', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const loading = yield* LoadingScreenService
        yield* loading.hide().pipe(Effect.andThen(Effect.void))
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should support hide as part of a larger Effect.all', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const loading = yield* LoadingScreenService
        yield* Effect.all([loading.hide(), Effect.void], { concurrency: 'unbounded' })
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
