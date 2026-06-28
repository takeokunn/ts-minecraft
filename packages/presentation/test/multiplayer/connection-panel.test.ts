import { describe, it } from '@effect/vitest'
import { afterEach, expect } from 'vitest'
import { Effect, Fiber, Layer, Option, Stream } from 'effect'
import { ConnectionPanelService, makeConnectionPanel } from '../../multiplayer/connection-panel'
import { DomOperationsService } from '../../hud/crosshair'

type Listener = (event: Event) => void

class TestElement {
  id = ''
  className = ''
  textContent = ''
  type = ''
  value = ''
  placeholder = ''
  disabled = false
  readonly children: TestElement[] = []
  parentElement: TestElement | null = null
  readonly style = { cssText: '', display: '' }
  private readonly attributes = new Map<string, string>()
  private readonly listeners = new Map<string, Listener[]>()

  constructor(readonly tagName: string) {}

  appendChild(child: TestElement): TestElement {
    child.parentElement = this
    this.children.push(child)
    return child
  }

  removeChild(child: TestElement): TestElement {
    child.parentElement = null
    const index = this.children.indexOf(child)
    if (index >= 0) this.children.splice(index, 1)
    return child
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(typeof listener === 'function' ? listener : (event) => listener.handleEvent(event))
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener?: EventListenerOrEventListenerObject): void {
    if (listener === undefined) {
      this.listeners.delete(type)
      return
    }
    if (typeof listener !== 'function') {
      this.listeners.delete(type)
      return
    }
    const listeners = this.listeners.get(type)
    if (!listeners) return
    const index = listeners.indexOf(listener)
    if (index >= 0) listeners.splice(index, 1)
    if (listeners.length === 0) this.listeners.delete(type)
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.length ?? 0
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) listener(new Event('click'))
  }

  querySelector<T extends HTMLElement>(selector: string): T | null {
    const matches = (el: TestElement): boolean => selector.startsWith('#')
      ? el.id === selector.slice(1)
      : selector.startsWith('.') && el.className.split(' ').includes(selector.slice(1))
    const visit = (el: TestElement): TestElement | null => {
      if (matches(el)) return el
      for (const child of el.children) {
        const found = visit(child)
        if (found) return found
      }
      return null
    }
    return visit(this) as unknown as T | null
  }
}

const asElement = <T extends HTMLElement>(element: unknown): T => element as T

const installDom = () => {
  const body = new TestElement('body')
  const root = new TestElement('div')
  root.id = 'multiplayer-root'
  body.appendChild(root)
  Reflect.set(globalThis, 'HTMLElement', TestElement)
  Reflect.set(globalThis, 'document', {
    body,
    createElement: (tagName: string) => new TestElement(tagName),
    getElementById: (id: string) => id === 'multiplayer-root' ? root : null,
  })
  return { root }
}

const domLayer = Layer.succeed(DomOperationsService, {
  createElement: (tagName) => document.createElement(tagName),
  appendChild: (element) => { document.body.appendChild(element) },
  appendChildTo: (parent, child) => { parent.appendChild(child) },
  removeChild: (element) => { element.parentElement?.removeChild(element) },
  getParentNode: (element) => Option.fromNullable(element.parentElement),
  setInnerHTML: (element, html) => { element.innerHTML = html },
  querySelector: (element, selector) => Option.fromNullable(element.querySelector(selector)),
} as DomOperationsService)

const makeLayer = (initialServerUrl?: string) => {
  const panelLayer = initialServerUrl === undefined
    ? ConnectionPanelService.Default
    : Layer.scoped(
      ConnectionPanelService,
      Effect.gen(function* () {
        const dom = yield* DomOperationsService
        return yield* makeConnectionPanel(dom, initialServerUrl)
      }),
    )

  return panelLayer.pipe(Layer.provide(domLayer))
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'document')
  Reflect.deleteProperty(globalThis, 'HTMLElement')
})

describe('presentation/multiplayer/connection-panel', () => {
  it.scoped('renders all elements', () => {
    const { root } = installDom()
    return Effect.gen(function* () {
      const panel = yield* ConnectionPanelService
      const serverInput = asElement<HTMLInputElement>(panel.element.querySelector('#mp-server-url'))
      const playerInput = asElement<HTMLInputElement>(panel.element.querySelector('#mp-player-name'))
      const button = asElement<HTMLButtonElement>(panel.element.querySelector('.mp-button'))
      const status = asElement<HTMLElement>(panel.element.querySelector('.mp-status'))
      expect(root.children.includes(panel.element as unknown as TestElement)).toBe(true)
      expect(panel.element.className).toBe('multiplayer-connection-panel')
      expect(panel.element.getAttribute('aria-label')).toBe('Multiplayer connection')
      expect(panel.element.getAttribute('aria-hidden')).toBe('true')
      expect(serverInput.getAttribute('aria-label')).toBe('Server URL')
      expect(serverInput.getAttribute('autocomplete')).toBe('url')
      expect(playerInput.getAttribute('aria-label')).toBe('Player name')
      expect(playerInput.getAttribute('autocomplete')).toBe('nickname')
      expect(button.textContent).toBe('Connect')
      expect(button.getAttribute('aria-label')).toBe('Connect to multiplayer server')
      expect(status.textContent).toBe('Disconnected')
      expect(status.getAttribute('role')).toBe('status')
      expect(status.getAttribute('aria-live')).toBe('polite')
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('prefills server URL from initial server URL', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ConnectionPanelService
      const serverInput = asElement<HTMLInputElement>(panel.element.querySelector('#mp-server-url'))
      expect(serverInput.value).toBe('ws://bootstrap.test')
    }).pipe(Effect.provide(makeLayer('ws://bootstrap.test')))
  })

  it('removes panel DOM and click listener when scope closes', async () => {
    const { root } = installDom()
    const state: {
      element: TestElement | null
      button: TestElement | null
    } = { element: null, button: null }

    await Effect.runPromise(
      Effect.gen(function* () {
        const panel = yield* ConnectionPanelService
        const button = panel.element.querySelector('.mp-button')
        if (button === null) throw new Error('missing connection button')

        state.element = panel.element as unknown as TestElement
        state.button = button as unknown as TestElement

        expect(root.children.includes(state.element)).toBe(true)
        expect(state.button.listenerCount('click')).toBe(1)
      }).pipe(Effect.provide(makeLayer())),
    )

    if (state.element === null || state.button === null) throw new Error('panel was not captured')
    expect(root.children.includes(state.element)).toBe(false)
    expect(state.button.listenerCount('click')).toBe(0)
  })

  it.scoped('click Connect emits server URL and player name', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ConnectionPanelService
      const serverInput = asElement<HTMLInputElement>(panel.element.querySelector('#mp-server-url'))
      const playerInput = asElement<HTMLInputElement>(panel.element.querySelector('#mp-player-name'))
      serverInput.value = ' ws://example.test '
      playerInput.value = ' Alex '
      asElement<HTMLButtonElement>(panel.element.querySelector('.mp-button')).click()
      const event = yield* Stream.runHead(panel.onConnect)
      expect(Option.getOrThrow(event)).toEqual({ serverUrl: 'ws://example.test', playerName: 'Alex' })
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('click Connect with an empty server URL shows validation and does not emit', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ConnectionPanelService
      const serverInput = asElement<HTMLInputElement>(panel.element.querySelector('#mp-server-url'))
      const button = asElement<HTMLButtonElement>(panel.element.querySelector('.mp-button'))

      serverInput.value = '   '
      button.click()

      const status = panel.element.querySelector('.mp-status')?.textContent
      expect(status).toBe('Server URL is required')

      const connectFiber = yield* Effect.fork(Stream.runHead(panel.onConnect))
      yield* Effect.yieldNow()
      const polled = yield* Fiber.poll(connectFiber)
      expect(Option.isNone(polled)).toBe(true)
      yield* Fiber.interrupt(connectFiber)
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('click Disconnect emits disconnect event', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ConnectionPanelService
      yield* panel.setConnected(true)
      asElement<HTMLButtonElement>(panel.element.querySelector('.mp-button')).click()
      const event = yield* Stream.runHead(panel.onDisconnect)
      expect(Option.isSome(event)).toBe(true)
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('updates status text', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ConnectionPanelService
      yield* panel.setStatus('Connecting...')
      expect(panel.element.querySelector('.mp-status')?.textContent).toBe('Connecting...')
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('setConnected(true) changes button text to Disconnect', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ConnectionPanelService
      const serverInput = asElement<HTMLInputElement>(panel.element.querySelector('#mp-server-url'))
      const playerInput = asElement<HTMLInputElement>(panel.element.querySelector('#mp-player-name'))
      const button = asElement<HTMLButtonElement>(panel.element.querySelector('.mp-button'))

      yield* panel.setConnected(true)
      expect(serverInput.disabled).toBe(true)
      expect(serverInput.getAttribute('aria-disabled')).toBe('true')
      expect(playerInput.disabled).toBe(true)
      expect(playerInput.getAttribute('aria-disabled')).toBe('true')
      expect(button.textContent).toBe('Disconnect')
      expect(button.getAttribute('aria-label')).toBe('Disconnect from multiplayer server')

      yield* panel.setConnected(false)
      expect(serverInput.disabled).toBe(false)
      expect(serverInput.getAttribute('aria-disabled')).toBe('false')
      expect(playerInput.disabled).toBe(false)
      expect(playerInput.getAttribute('aria-disabled')).toBe('false')
      expect(button.textContent).toBe('Connect')
      expect(button.getAttribute('aria-label')).toBe('Connect to multiplayer server')
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('show and hide toggle visibility', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ConnectionPanelService
      yield* panel.show
      expect(panel.element.style.display).toBe('flex')
      expect(panel.element.getAttribute('aria-hidden')).toBe('false')
      yield* panel.hide
      expect(panel.element.style.display).toBe('none')
      expect(panel.element.getAttribute('aria-hidden')).toBe('true')
    }).pipe(Effect.provide(makeLayer()))
  })
})
