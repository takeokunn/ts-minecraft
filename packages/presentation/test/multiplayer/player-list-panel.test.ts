import { describe, it } from '@effect/vitest'
import { afterEach, expect } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { PlayerListPanelService } from '../../multiplayer/player-list-panel'
import { DomOperationsService } from '../../hud/crosshair'
import type { RemotePlayerSnapshot } from '../../../app/application/multiplayer/multiplayer-service'

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

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
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
  setInnerHTML: (element, html) => {
    element.children.splice(0, element.children.length)
    element.textContent = html
  },
  querySelector: (element, selector) => Option.fromNullable(element.querySelector(selector)),
} as DomOperationsService)

const makeLayer = () =>
  PlayerListPanelService.Default.pipe(Layer.provide(domLayer))

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'document')
  Reflect.deleteProperty(globalThis, 'HTMLElement')
})

describe('presentation/multiplayer/player-list-panel', () => {
  it.scoped('renders the panel in the multiplayer root', () => {
    const { root } = installDom()
    return Effect.gen(function* () {
      const panel = yield* PlayerListPanelService
      expect(root.children.includes(panel.element as unknown as TestElement)).toBe(true)
      expect(panel.element.id).toBe('multiplayer-player-list-panel')
      expect(panel.element.className).toBe('multiplayer-player-list-panel')
      expect(panel.element.getAttribute('aria-label')).toBe('Multiplayer player list')
      expect(panel.element.getAttribute('aria-hidden')).toBe('true')
      expect(panel.element.querySelector('.mp-player-list-title')?.textContent).toBe('Players online')
      expect(panel.element.querySelector('.mp-player-list-subtitle')?.textContent).toBe('Tab to hide this panel')
      expect(panel.element.querySelector('.mp-player-list-count')?.textContent).toBe('0 players')
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('show and hide toggle visibility', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* PlayerListPanelService
      yield* panel.show
      expect(panel.element.style.display).toBe('flex')
      expect(panel.element.getAttribute('aria-hidden')).toBe('false')
      yield* panel.hide
      expect(panel.element.style.display).toBe('none')
      expect(panel.element.getAttribute('aria-hidden')).toBe('true')
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('renders player rows and updates the player count', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* PlayerListPanelService
      const players: ReadonlyArray<RemotePlayerSnapshot> = [
        {
          playerId: 'player-1',
          playerName: 'Alex',
          x: 1.25,
          y: 64,
          z: -2.5,
          yaw: 90,
          pitch: 0,
        },
        {
          playerId: 'player-2',
          playerName: 'Sam',
          x: 10,
          y: 70,
          z: 3,
          yaw: 0,
          pitch: 0,
        },
      ]

      yield* panel.setPlayers(players)

      const list = asElement<HTMLElement>(panel.element.querySelector('.mp-player-list'))
      expect(panel.element.querySelector('.mp-player-list-count')?.textContent).toBe('2 players')
      expect(list.children.length).toBe(2)
      expect(list.children[0].querySelector('.mp-player-name')?.textContent).toBe('Alex')
      expect(list.children[0].querySelector('.mp-player-meta')?.textContent).toBe('x:1.3 y:64.0 z:-2.5')
      expect(list.children[1].querySelector('.mp-player-name')?.textContent).toBe('Sam')
      expect(list.children[1].querySelector('.mp-player-meta')?.textContent).toBe('x:10.0 y:70.0 z:3.0')
    }).pipe(Effect.provide(makeLayer()))
  })

  it('removes panel DOM when scope closes', async () => {
    const { root } = installDom()
    const state: { element: TestElement | null } = { element: null }

    await Effect.runPromise(
      Effect.gen(function* () {
        const panel = yield* PlayerListPanelService
        state.element = panel.element as unknown as TestElement
        expect(root.children.includes(state.element)).toBe(true)
      }).pipe(Effect.provide(makeLayer())),
    )

    if (state.element === null) throw new Error('panel was not captured')
    expect(root.children.includes(state.element)).toBe(false)
  })
})
