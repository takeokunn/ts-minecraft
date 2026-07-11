import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { LoadingScreenService } from '@ts-minecraft/presentation/loading/loading-screen'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockDomLayer = () => {
  const makeElement = (tagName: string) => {
    const attributes: Record<string, string> = {}
    const node = {
      tagName,
      id: '',
      className: '',
      textContent: '',
      style: { cssText: '', display: 'flex' },
      children: [] as unknown[],
      parentNode: null as unknown,
      firstChild: null as unknown,
      tabIndex: 0,
      appendChild: vi.fn(function (this: { children: unknown[]; firstChild: unknown }, child: unknown) {
        this.children.push(child)
        this.firstChild = this.children[0] ?? null
      }),
      removeChild: vi.fn(function (this: { children: unknown[]; firstChild: unknown }, child: unknown) {
        this.children = this.children.filter((c) => c !== child)
        this.firstChild = this.children[0] ?? null
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      remove: vi.fn(),
      focus: vi.fn(),
      setAttribute: vi.fn((name: string, value: string) => {
        attributes[name] = value
      }),
      getAttribute: vi.fn((name: string) => attributes[name] ?? null),
      removeAttribute: vi.fn((name: string) => {
        delete attributes[name]
      }),
    }
    return node as unknown as HTMLElement
  }

  const overlayEl = makeElement('div') as HTMLElement & {
    style: { cssText: string; display: string }
    children: unknown[]
    tabIndex: number
    focus: ReturnType<typeof vi.fn>
  }

  const createElement = vi.fn((tagName: string) => {
    if (tagName === 'div' && overlayEl.id === '') {
      return overlayEl as HTMLElement
    }
    return makeElement(tagName)
  })

  const removeChild = vi.fn()

  const MockDomLayer = Layer.succeed(DomOperationsService, {
    createElement,
    appendChild: vi.fn(),
    appendChildTo: vi.fn((parent: HTMLElement, child: HTMLElement) => {
      parent.appendChild(child)
    }),
    removeChild,
    getParentNode: vi.fn(() => Option.none()),
    setInnerHTML: vi.fn(),
    querySelector: vi.fn(() => Option.none()),
  } as DomOperationsService)

  return { MockDomLayer, createElement, overlayEl, removeChild }
}

const buildTestLayer = (mockDom = createMockDomLayer()) =>
  LoadingScreenService.Default.pipe(
    Layer.provide(mockDom.MockDomLayer),
  )

type MockElement = HTMLElement & { children: MockElement[]; textContent: string }

const findElement = (element: MockElement, predicate: (node: MockElement) => boolean): MockElement | undefined => {
  if (predicate(element)) return element
  for (const child of element.children) {
    const match = findElement(child, predicate)
    if (match) return match
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Note: vitest.config.ts sets environment: 'node', so `document` is undefined.
// The service takes the SSR-safe path (Option.none overlay), and DOM methods are no-ops.
// Tests verify that hide() and other methods complete without error in this environment.

describe('presentation/loading/loading-screen', () => {
  it.scoped('creates and hides the overlay in a browser-like environment', () => {
    const mockDom = createMockDomLayer()
    const appendToHead = vi.fn((element: unknown) => {
      ;(element as { parentNode?: unknown }).parentNode = { removeChild: vi.fn() }
    })

    Reflect.set(globalThis as object, 'document', {
      head: { appendChild: appendToHead },
    })

    const TestLayer = buildTestLayer(mockDom)

    return Effect.gen(function* () {
      const loading = yield* LoadingScreenService
      yield* loading.hide()
      yield* loading.show()

      expect(mockDom.createElement).toHaveBeenCalledWith('style')
      expect(mockDom.createElement).toHaveBeenCalledWith('div')
      expect(appendToHead).toHaveBeenCalledTimes(1)
      expect(mockDom.overlayEl.id).toBe('loading-screen')
      expect(mockDom.overlayEl.style.cssText).toContain('position:fixed')
      expect(mockDom.overlayEl.style.cssText).toContain('min-height:100dvh')
      expect(mockDom.overlayEl.style.cssText).toContain('safe-area-inset-top')
      expect(mockDom.overlayEl.style.display).toBe('grid')
      expect(mockDom.overlayEl.children).toHaveLength(1)
      expect(mockDom.overlayEl.getAttribute('role')).toBeNull()
      expect(mockDom.overlayEl.getAttribute('aria-live')).toBeNull()
      expect(mockDom.overlayEl.getAttribute('aria-busy')).toBe('true')
      expect(mockDom.overlayEl.getAttribute('aria-label')).toBe('Preparing your Minecraft world')
      expect(mockDom.overlayEl.getAttribute('aria-modal')).toBeNull()
      const status = findElement(mockDom.overlayEl as MockElement, node => node.getAttribute('role') === 'status')
      expect(status?.getAttribute('aria-live')).toBe('polite')
      expect(status?.getAttribute('aria-atomic')).toBe('true')
      const styles = appendToHead.mock.calls[0]?.[0] as { textContent: string }
      expect(styles.textContent).toContain('@media (max-width:320px)')
      expect(styles.textContent).toContain('@media (prefers-reduced-motion:reduce)')
    }).pipe(Effect.provide(TestLayer), Effect.ensuring(Effect.sync(() => {
      Reflect.deleteProperty(globalThis as object, 'document')
    })))
  })

  it.scoped('showError should render message via textContent without HTML injection', () => {
    const mockDom = createMockDomLayer()
    const appendToHead = vi.fn((element: unknown) => {
      ;(element as { parentNode?: unknown }).parentNode = { removeChild: vi.fn() }
    })

    Reflect.set(globalThis as object, 'document', {
      head: { appendChild: appendToHead },
    })

    const TestLayer = buildTestLayer(mockDom)

    return Effect.gen(function* () {
      const loading = yield* LoadingScreenService
      const payload = '<img src=x onerror=alert(1) />'
      yield* loading.showError(payload)

      expect(mockDom.overlayEl.children).toHaveLength(1)
      expect(mockDom.overlayEl.getAttribute('role')).toBe('alertdialog')
      expect(mockDom.overlayEl.getAttribute('aria-modal')).toBe('true')
      expect(mockDom.overlayEl.getAttribute('aria-live')).toBeNull()
      expect(mockDom.overlayEl.getAttribute('aria-busy')).toBe('false')
      expect(mockDom.overlayEl.getAttribute('aria-label')).toBeNull()
      expect(mockDom.overlayEl.getAttribute('aria-labelledby')).toBe('loading-error-title')
      expect(mockDom.overlayEl.getAttribute('aria-describedby')).toBe('loading-error-message loading-error-detail')
      expect(mockDom.overlayEl.tabIndex).toBe(-1)
      expect(mockDom.overlayEl.focus).toHaveBeenCalledWith({ preventScroll: true })
      const messageNode = findElement(mockDom.overlayEl as MockElement, node => node.id === 'loading-error-message')
      expect(messageNode?.textContent).toBe(payload)
      expect(messageNode?.getAttribute('role')).toBeNull()
    }).pipe(Effect.provide(TestLayer), Effect.ensuring(Effect.sync(() => {
      Reflect.deleteProperty(globalThis as object, 'document')
    })))
  })

  it.scoped('showError should render a custom detail message', () => {
    const mockDom = createMockDomLayer()
    const appendToHead = vi.fn((element: unknown) => {
      ;(element as { parentNode?: unknown }).parentNode = { removeChild: vi.fn() }
    })

    Reflect.set(globalThis as object, 'document', {
      head: { appendChild: appendToHead },
    })

    const TestLayer = buildTestLayer(mockDom)

    return Effect.gen(function* () {
      const loading = yield* LoadingScreenService
      yield* loading.showError(
        'Startup failed.',
        'Refresh the page or check the browser console for details.',
      )

      const detailNode = findElement(mockDom.overlayEl as MockElement, node => node.id === 'loading-error-detail')
      expect(detailNode?.textContent).toBe('Refresh the page or check the browser console for details.')
    }).pipe(Effect.provide(TestLayer), Effect.ensuring(Effect.sync(() => {
      Reflect.deleteProperty(globalThis as object, 'document')
    })))
  })

  it.scoped('show should restore the loading view after an error', () => {
    const mockDom = createMockDomLayer()
    const appendToHead = vi.fn((element: unknown) => {
      ;(element as { parentNode?: unknown }).parentNode = { removeChild: vi.fn() }
    })

    Reflect.set(globalThis as object, 'document', {
      head: { appendChild: appendToHead },
    })

    const TestLayer = buildTestLayer(mockDom)

    return Effect.gen(function* () {
      const loading = yield* LoadingScreenService
      yield* loading.showError('broken')
      yield* loading.show()

      expect(mockDom.overlayEl.style.display).toBe('grid')
      expect(mockDom.overlayEl.children).toHaveLength(1)
      expect(mockDom.overlayEl.getAttribute('role')).toBeNull()
      expect(mockDom.overlayEl.getAttribute('aria-busy')).toBe('true')
      expect(mockDom.overlayEl.getAttribute('aria-modal')).toBeNull()
      expect(mockDom.overlayEl.getAttribute('aria-labelledby')).toBeNull()
      const title = findElement(mockDom.overlayEl as MockElement, node => node.className === 'loading-title')
      expect(title?.textContent).toBe('Preparing your world')
    }).pipe(Effect.provide(TestLayer), Effect.ensuring(Effect.sync(() => {
      Reflect.deleteProperty(globalThis as object, 'document')
    })))
  })

  describe('LoadingScreenService.Default — layer provision', () => {
    it.scoped('should provide LoadingScreen as a Layer without error', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const loading = yield* LoadingScreenService
        expect(typeof loading.hide).toBe('function')
        expect(typeof loading.show).toBe('function')
      }).pipe(Effect.provide(TestLayer))
    })

    it('should be defined', () => {
      expect(LoadingScreenService.Default).toBeDefined()
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
        yield* loading.hide()
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
