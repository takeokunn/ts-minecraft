import { describe, expect, it, vi, afterEach } from 'vitest'
import { Effect } from 'effect'
import type { DebugFeatureSnapshot } from '@ts-minecraft/app/application/debug-feature-flags'
import {
  DEBUG_FEATURE_FLAG_CATALOG,
  DEBUG_FEATURE_FLAG_DEFAULTS,
} from '@ts-minecraft/app/application/debug-feature-flags'
import type { DebugOverlayDeps, DebugOverlayDomNodes } from '@ts-minecraft/presentation/hud/debug-overlay-types'
import { buildDebugOverlayDom } from '@ts-minecraft/presentation/hud/debug-overlay-dom'

type Listener = (event: Event) => void

type TestNode = TestElement | TestText

class TestText {
  constructor(public nodeValue: string) {}
}

class TestElement {
  id = ''
  type = ''
  value = ''
  placeholder = ''
  textContent: string | null = null
  innerHTML = ''
  focused = false
  blurCount = 0
  readonly dataset: Record<string, string> = {}
  readonly attributes = new Map<string, string>()
  readonly children: TestNode[] = []
  readonly style: Record<string, string> & { cssText: string } = { cssText: '' }
  private readonly listeners = new Map<string, Array<Listener>>()

  constructor(readonly tagName: string) {}

  appendChild(child: TestNode): TestNode {
    this.children.push(child)
    return child
  }

  removeChild(child: TestNode): TestNode {
    const index = this.children.indexOf(child)
    if (index >= 0) this.children.splice(index, 1)
    return child
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(typeof listener === 'function' ? listener : (event) => listener.handleEvent(event))
    this.listeners.set(type, listeners)
  }

  dispatchKeyboardEvent(key: string): { readonly defaultPrevented: boolean } {
    let defaultPrevented = false
    const event = {
      type: 'keydown',
      key,
      preventDefault: () => {
        defaultPrevented = true
      },
      get defaultPrevented() {
        return defaultPrevented
      },
    } as KeyboardEvent
    for (const listener of this.listeners.get('keydown') ?? []) listener(event)
    return event
  }

  dispatchInputEvent(): void {
    const event = { type: 'input' } as Event
    for (const listener of this.listeners.get('input') ?? []) listener(event)
  }

  focus(): void {
    this.focused = true
  }

  blur(): void {
    this.focused = false
    this.blurCount += 1
  }
}

class TestDocument {
  readonly body = new TestElement('body')
  readonly roots: TestElement[] = []

  createElement(tagName: string): TestElement {
    return new TestElement(tagName)
  }

  createTextNode(text: string): TestText {
    return new TestText(text)
  }

  appendRoot(element: TestElement): void {
    this.roots.push(element)
  }
}

const makeSnapshot = (): DebugFeatureSnapshot => ({
  catalog: DEBUG_FEATURE_FLAG_CATALOG,
  flags: { ...DEBUG_FEATURE_FLAG_DEFAULTS },
})

const makeDeps = (getSnapshot: () => Effect.Effect<DebugFeatureSnapshot, never>): DebugOverlayDeps => ({
  biomeService: {} as never,
  chunkManager: {} as never,
  gameState: {} as never,
  timeService: {} as never,
  cameraState: {} as never,
  fpsCounter: {} as never,
  debugFeatureFlags: {
    getSnapshot,
    getFlags: () => Effect.succeed(DEBUG_FEATURE_FLAG_DEFAULTS),
    isEnabled: () => Effect.succeed(false),
    setEnabled: () => Effect.succeed(false),
    resetAll: () => Effect.succeed(undefined),
    resetGroup: () => Effect.succeed(undefined),
  } as DebugOverlayDeps['debugFeatureFlags'],
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildDebugOverlayDom', () => {
  it('clears the search query on Escape when text is present and refreshes the panel', async () => {
    const document = new TestDocument()
    vi.stubGlobal('document', document)

    const observedQueries: string[] = []
    let dom: DebugOverlayDomNodes | null = null
    const deps = makeDeps(() =>
      Effect.sync(() => {
        observedQueries.push(dom?.searchInput.value ?? '<unset>')
        return makeSnapshot()
      }),
    )

    dom = buildDebugOverlayDom(deps, () => null)
    document.appendRoot(dom.overlay as unknown as TestElement)

    const searchInput = dom.searchInput as unknown as TestElement
    searchInput.value = 'rendering'

    const event = searchInput.dispatchKeyboardEvent('Escape')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(event.defaultPrevented).toBe(true)
    expect(searchInput.value).toBe('')
    expect(observedQueries).toEqual([''])
  })

  it('blurs the search field on Escape when the query is empty', async () => {
    const document = new TestDocument()
    vi.stubGlobal('document', document)

    const observedQueries: string[] = []
    const deps = makeDeps(() =>
      Effect.sync(() => {
        observedQueries.push('refresh')
        return makeSnapshot()
      }),
    )

    const dom = buildDebugOverlayDom(deps, () => null)
    document.appendRoot(dom.overlay as unknown as TestElement)

    const searchInput = dom.searchInput as unknown as TestElement
    searchInput.focus()

    const event = searchInput.dispatchKeyboardEvent('Escape')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(event.defaultPrevented).toBe(true)
    expect(searchInput.blurCount).toBe(1)
    expect(searchInput.focused).toBe(false)
    expect(observedQueries).toEqual([])
  })
})
