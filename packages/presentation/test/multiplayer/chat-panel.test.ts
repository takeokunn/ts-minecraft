import { describe, it } from '@effect/vitest'
import { afterEach, expect } from 'vitest'
import { Effect, Layer, Option, Stream } from 'effect'
import { ChatPanelService } from '../../multiplayer/chat-panel'
import { DomOperationsService } from '../../hud/crosshair'

type Listener = (event: Event) => void

class TestElement {
  id = ''
  className = ''
  textContent = ''
  type = ''
  value = ''
  placeholder = ''
  autocomplete = ''
  disabled = false
  innerHTML = ''
  scrollTop = 0
  scrollHeight = 0
  readonly children: TestElement[] = []
  parentElement: TestElement | null = null
  readonly style = { cssText: '', display: '' }
  private readonly listeners = new Map<string, Listener[]>()

  constructor(readonly tagName: string) {}

  get firstChild(): TestElement | null {
    return this.children[0] ?? null
  }

  appendChild(child: TestElement): TestElement {
    child.parentElement = this
    this.children.push(child)
    this.scrollHeight = this.children.length
    return child
  }

  removeChild(child: TestElement): TestElement {
    child.parentElement = null
    const index = this.children.indexOf(child)
    if (index >= 0) this.children.splice(index, 1)
    this.scrollHeight = this.children.length
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

  keyDown(key: string): boolean {
    let prevented = false
    const event = {
      key,
      preventDefault: () => {
        prevented = true
      },
    } as unknown as Event
    for (const listener of this.listeners.get('keydown') ?? []) listener(event)
    return prevented
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

const makeLayer = () => ChatPanelService.Default.pipe(
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

describe('presentation/multiplayer/chat-panel', () => {
  it.scoped('renders disabled chat controls under the multiplayer root', () => {
    const { root } = installDom()
    return Effect.gen(function* () {
      const panel = yield* ChatPanelService
      expect(root.children.includes(panel.element as unknown as TestElement)).toBe(true)
      expect(panel.element.className).toBe('mp-chat-panel')
      expect(panel.element.querySelector('.mp-chat-status')?.textContent).toBe('Disconnected')
      expect(asElement<HTMLInputElement>(panel.element.querySelector('.mp-chat-input')).disabled).toBe(true)
      expect(asElement<HTMLButtonElement>(panel.element.querySelector('.mp-chat-send')).disabled).toBe(true)
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('setConnected(true) enables input and show/hide toggles visibility', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ChatPanelService
      yield* panel.setConnected(true)
      expect(panel.element.querySelector('.mp-chat-status')?.textContent).toBe('Connected')
      expect(asElement<HTMLInputElement>(panel.element.querySelector('.mp-chat-input')).disabled).toBe(false)
      expect(asElement<HTMLButtonElement>(panel.element.querySelector('.mp-chat-send')).disabled).toBe(false)
      yield* panel.show
      expect(panel.element.style.display).toBe('flex')
      yield* panel.hide
      expect(panel.element.style.display).toBe('none')
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('click Send emits a trimmed message and clears the input', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ChatPanelService
      yield* panel.setConnected(true)
      const input = asElement<HTMLInputElement>(panel.element.querySelector('.mp-chat-input'))
      input.value = ' hello team '
      asElement<HTMLButtonElement>(panel.element.querySelector('.mp-chat-send')).click()
      const event = yield* Stream.runHead(panel.onSend)
      expect(Option.getOrThrow(event)).toBe('hello team')
      expect(input.value).toBe('')
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('Enter sends the current message and prevents the browser default', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ChatPanelService
      yield* panel.setConnected(true)
      const input = panel.element.querySelector('.mp-chat-input') as unknown as TestElement
      input.value = 'enter message'
      expect(input.keyDown('Enter')).toBe(true)
      const event = yield* Stream.runHead(panel.onSend)
      expect(Option.getOrThrow(event)).toBe('enter message')
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('setMessages renders chat entries as text content', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ChatPanelService
      yield* panel.setMessages([{ player: 'Alex', text: '<script>ignored</script>', timestamp: 1 }])
      const messages = panel.element.querySelector('.mp-chat-messages') as unknown as TestElement
      expect(messages.children).toHaveLength(1)
      expect(messages.children[0]?.textContent).toBe('Alex: <script>ignored</script>')
    }).pipe(Effect.provide(makeLayer()))
  })
})
