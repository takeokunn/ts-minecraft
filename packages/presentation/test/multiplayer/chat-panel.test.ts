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
  disabled = false
  innerHTML = ''
  scrollTop = 0
  scrollHeight = 0
  focused = false
  isContentEditable = false
  readonly children: TestElement[] = []
  parentElement: TestElement | null = null
  readonly style = { cssText: '', display: '' }
  private readonly attributes = new Map<string, string>()
  private readonly listeners = new Map<string, Listener[]>()

  constructor(readonly tagName: string) {}

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

  submit(): void {
    for (const listener of this.listeners.get('submit') ?? []) listener(new Event('submit'))
  }

  focus(): void {
    this.focused = true
  }

  blur(): void {
    this.focused = false
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

type TestKeyboardEvent = KeyboardEvent & {
  readonly propagationStopped: boolean
}

class TestDocument {
  readonly body = new TestElement('body')
  readonly root = new TestElement('div')
  private readonly listeners = new Map<string, Listener[]>()

  constructor() {
    this.root.id = 'multiplayer-root'
    this.body.appendChild(this.root)
  }

  createElement(tagName: string): TestElement {
    return new TestElement(tagName)
  }

  getElementById(id: string): TestElement | null {
    return id === 'multiplayer-root' ? this.root : null
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

  dispatchKeyDown(init: {
    readonly key: string
    readonly code?: string
    readonly target?: TestElement | null
  }): TestKeyboardEvent {
    let defaultPrevented = false
    let propagationStopped = false
    const event = {
      type: 'keydown',
      key: init.key,
      code: init.code ?? '',
      target: init.target ?? null,
      get defaultPrevented() {
        return defaultPrevented
      },
      get propagationStopped() {
        return propagationStopped
      },
      preventDefault: () => {
        defaultPrevented = true
      },
      stopPropagation: () => {
        propagationStopped = true
      },
    } as TestKeyboardEvent

    for (const listener of this.listeners.get('keydown') ?? []) listener(event)
    return event
  }
}

const asElement = <T extends HTMLElement>(element: unknown): T => element as T

const installDom = () => {
  const testDocument = new TestDocument()
  Reflect.set(globalThis, 'HTMLElement', TestElement)
  Reflect.set(globalThis, 'document', testDocument)
  return { document: testDocument, root: testDocument.root }
}

const makeLayer = () => ChatPanelService.Default.pipe(
  Layer.provide(Layer.succeed(DomOperationsService, {
    createElement: (tagName) => document.createElement(tagName),
    appendChild: (element) => { document.body.appendChild(element) },
    appendChildTo: (parent, child) => { parent.appendChild(child) },
    removeChild: (element) => { element.parentElement?.removeChild(element) },
    getParentNode: (element) => Option.fromNullable(element.parentElement),
    setInnerHTML: (element, html) => {
      element.innerHTML = html
      const testElement = element as unknown as TestElement
      for (const child of testElement.children) child.parentElement = null
      testElement.children.splice(0)
      testElement.scrollHeight = 0
    },
    querySelector: (element, selector) => Option.fromNullable(element.querySelector(selector)),
  } as DomOperationsService)),
)

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'document')
  Reflect.deleteProperty(globalThis, 'HTMLElement')
})

describe('presentation/multiplayer/chat-panel', () => {
  it.scoped('renders chat elements under the multiplayer root', () => {
    const { root } = installDom()
    return Effect.gen(function* () {
      const panel = yield* ChatPanelService
      const input = asElement<HTMLInputElement>(panel.element.querySelector('#mp-chat-input'))
      const button = asElement<HTMLButtonElement>(panel.element.querySelector('.mp-chat-send'))
      const messages = asElement<HTMLElement>(panel.element.querySelector('.mp-chat-messages'))
      const status = asElement<HTMLElement>(panel.element.querySelector('.mp-chat-status'))

      expect(root.children.includes(panel.element as unknown as TestElement)).toBe(true)
      expect(panel.element.className).toBe('multiplayer-chat-panel')
      expect(panel.element.getAttribute('aria-label')).toBe('Multiplayer chat')
      expect(panel.element.getAttribute('aria-hidden')).toBe('true')
      expect(messages.getAttribute('role')).toBe('log')
      expect(messages.getAttribute('aria-live')).toBe('polite')
      expect(messages.getAttribute('aria-relevant')).toBe('additions text')
      expect(input.getAttribute('aria-label')).toBe('Chat message')
      expect(input.getAttribute('aria-disabled')).toBe('true')
      expect(input.getAttribute('autocomplete')).toBe('off')
      expect(input.disabled).toBe(true)
      expect(button.getAttribute('aria-label')).toBe('Send chat message')
      expect(button.getAttribute('aria-disabled')).toBe('true')
      expect(button.disabled).toBe(true)
      expect(status.getAttribute('role')).toBe('status')
      expect(status.getAttribute('aria-live')).toBe('polite')
      expect(status.textContent).toBe('Connect to a server to chat')
    }).pipe(Effect.provide(makeLayer()))
  })

  it('removes panel DOM and submit listener when scope closes', async () => {
    const { document, root } = installDom()
    const state: {
      element: TestElement | null
      form: TestElement | null
    } = { element: null, form: null }

    await Effect.runPromise(
      Effect.gen(function* () {
        const panel = yield* ChatPanelService
        const form = panel.element.querySelector('.mp-chat-form')
        if (form === null) throw new Error('missing chat form')

        state.element = panel.element as unknown as TestElement
        state.form = form as unknown as TestElement

        expect(root.children.includes(state.element)).toBe(true)
        expect(state.form.listenerCount('submit')).toBe(1)
        expect(document.listenerCount('keydown')).toBe(1)
      }).pipe(Effect.provide(makeLayer())),
    )

    if (state.element === null || state.form === null) throw new Error('panel was not captured')
    expect(root.children.includes(state.element)).toBe(false)
    expect(state.form.listenerCount('submit')).toBe(0)
    expect(document.listenerCount('keydown')).toBe(0)
  })

  it.scoped('submit emits a trimmed message and clears the input', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ChatPanelService
      const form = asElement<HTMLFormElement>(panel.element.querySelector('.mp-chat-form'))
      const input = asElement<HTMLInputElement>(panel.element.querySelector('#mp-chat-input'))

      yield* panel.setConnected(true)
      input.value = ' hello world '
      form.submit()

      const event = yield* Stream.runHead(panel.onSend)
      expect(Option.getOrThrow(event)).toBe('hello world')
      expect(input.value).toBe('')
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('does not emit blank messages', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ChatPanelService
      const form = asElement<HTMLFormElement>(panel.element.querySelector('.mp-chat-form'))
      const input = asElement<HTMLInputElement>(panel.element.querySelector('#mp-chat-input'))

      yield* panel.setConnected(true)
      input.value = '   '
      form.submit()

      expect(input.value).toBe('   ')

      input.value = ' real message '
      form.submit()

      const event = yield* Stream.runHead(panel.onSend)
      expect(Option.getOrThrow(event)).toBe('real message')
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('setConnected toggles input state and status text', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ChatPanelService
      const input = asElement<HTMLInputElement>(panel.element.querySelector('#mp-chat-input'))
      const button = asElement<HTMLButtonElement>(panel.element.querySelector('.mp-chat-send'))

      yield* panel.setConnected(true)
      expect(input.disabled).toBe(false)
      expect(input.getAttribute('aria-disabled')).toBe('false')
      expect(button.disabled).toBe(false)
      expect(button.getAttribute('aria-disabled')).toBe('false')
      expect(panel.element.querySelector('.mp-chat-status')?.textContent).toBe('Chat ready')

      yield* panel.setConnected(false)
      expect(input.disabled).toBe(true)
      expect(input.getAttribute('aria-disabled')).toBe('true')
      expect(button.disabled).toBe(true)
      expect(button.getAttribute('aria-disabled')).toBe('true')
      expect(panel.element.querySelector('.mp-chat-status')?.textContent).toBe('Connect to a server to chat')
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('setMessages renders the latest 50 messages and scrolls to the bottom', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ChatPanelService
      const messages = Array.from({ length: 55 }, (_, index) => ({
        player: `p${index}`,
        text: `message <${index}>`,
        timestamp: 0,
      }))

      yield* panel.setMessages(messages)

      const list = panel.element.querySelector('.mp-chat-messages') as unknown as TestElement
      expect(list.children).toHaveLength(50)
      expect(list.children[0]?.children[1]?.textContent).toBe('<p5>')
      expect(list.children[0]?.children[2]?.textContent).toBe('message <5>')
      expect(list.scrollTop).toBe(list.scrollHeight)
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('show and hide toggle visibility', () => {
    installDom()
    return Effect.gen(function* () {
      const panel = yield* ChatPanelService
      yield* panel.show
      expect(panel.element.style.display).toBe('flex')
      expect(panel.element.getAttribute('aria-hidden')).toBe('false')
      yield* panel.hide
      expect(panel.element.style.display).toBe('none')
      expect(panel.element.getAttribute('aria-hidden')).toBe('true')
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('T opens the chat panel and focuses the input when connected', () => {
    const { document } = installDom()
    return Effect.gen(function* () {
      const panel = yield* ChatPanelService
      const input = asElement<HTMLInputElement>(panel.element.querySelector('#mp-chat-input'))

      yield* panel.setConnected(true)

      const event = document.dispatchKeyDown({ key: 't', code: 'KeyT' })

      expect(panel.element.style.display).toBe('flex')
      expect(panel.element.getAttribute('aria-hidden')).toBe('false')
      expect((input as unknown as TestElement).focused).toBe(true)
      expect(event.defaultPrevented).toBe(true)
      expect(event.propagationStopped).toBe(true)
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('does not consume T while typing in an editable target', () => {
    const { document } = installDom()
    return Effect.gen(function* () {
      const panel = yield* ChatPanelService
      const input = asElement<HTMLInputElement>(panel.element.querySelector('#mp-chat-input'))

      yield* panel.hide

      const event = document.dispatchKeyDown({
        key: 't',
        code: 'KeyT',
        target: input as unknown as TestElement,
      })

      expect(panel.element.style.display).toBe('none')
      expect(event.defaultPrevented).toBe(false)
      expect(event.propagationStopped).toBe(false)
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('Escape closes the chat panel and releases input focus', () => {
    const { document } = installDom()
    return Effect.gen(function* () {
      const panel = yield* ChatPanelService
      const input = asElement<HTMLInputElement>(panel.element.querySelector('#mp-chat-input'))

      yield* panel.setConnected(true)
      yield* panel.show
      expect((input as unknown as TestElement).focused).toBe(true)

      const event = document.dispatchKeyDown({ key: 'Escape' })

      expect(panel.element.style.display).toBe('none')
      expect(panel.element.getAttribute('aria-hidden')).toBe('true')
      expect((input as unknown as TestElement).focused).toBe(false)
      expect(event.defaultPrevented).toBe(true)
      expect(event.propagationStopped).toBe(true)
    }).pipe(Effect.provide(makeLayer()))
  })
})
