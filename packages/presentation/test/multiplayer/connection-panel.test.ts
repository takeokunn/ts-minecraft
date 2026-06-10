import { describe, it } from '@effect/vitest'
import { afterEach, expect } from 'vitest'
import { Effect, Layer, Option, Stream } from 'effect'
import { ConnectionPanelService, ConnectionPanelLive } from '../../multiplayer/connection-panel'
import { DomOperationsService } from '../../hud/crosshair'

type Listener = (event: Event) => void

class TestElement {
  id = ''
  className = ''
  textContent = ''
  type = ''
  value = ''
  placeholder = ''
  readonly children: TestElement[] = []
  parentElement: TestElement | null = null
  readonly style = { cssText: '', display: '' }
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

  removeEventListener(type: string): void {
    this.listeners.delete(type)
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

const makeLayer = () => ConnectionPanelLive.pipe(
  Layer.provide(Layer.succeed(DomOperationsService, {
    createElement: (tagName) => document.createElement(tagName),
    appendChild: (element) => { document.body.appendChild(element) },
    appendChildTo: (parent, child) => { parent.appendChild(child) },
    removeChild: (element) => { element.parentElement?.removeChild(element) },
    getParentNode: (element) => Option.fromNullable(element.parentElement),
    setInnerHTML: (element, html) => { element.innerHTML = html },
    querySelector: (element, selector) => Option.fromNullable(element.querySelector(selector)),
  } as DomOperationsService)),
)

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'document')
  Reflect.deleteProperty(globalThis, 'HTMLElement')
})

describe('presentation/multiplayer/connection-panel', () => {
  it.scoped('renders all elements', () => {
    const { root } = installDom()
    return Effect.gen(function* () {
      const panel = yield* ConnectionPanelService
      expect(root.children.includes(panel.element as unknown as TestElement)).toBe(true)
      expect(panel.element.className).toBe('multiplayer-connection-panel')
      expect(panel.element.querySelector('#mp-server-url')).toBeDefined()
      expect(panel.element.querySelector('#mp-player-name')).toBeDefined()
      expect(panel.element.querySelector('.mp-button')?.textContent).toBe('Connect')
      expect(panel.element.querySelector('.mp-status')?.textContent).toBe('Disconnected')
    }).pipe(Effect.provide(makeLayer()))
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
      yield* panel.setConnected(true)
      expect(panel.element.querySelector('.mp-button')?.textContent).toBe('Disconnect')
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('show and hide toggle visibility', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ConnectionPanelService
      yield* panel.show
      expect(panel.element.style.display).toBe('flex')
      yield* panel.hide
      expect(panel.element.style.display).toBe('none')
    }).pipe(Effect.provide(makeLayer()))
  })
})
