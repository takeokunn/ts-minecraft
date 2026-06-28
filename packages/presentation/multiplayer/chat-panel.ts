import { Effect, Queue, Stream } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'

export interface ChatPanelEntry {
  readonly player: string
  readonly text: string
  readonly timestamp: number
}

export interface ChatPanel {
  readonly element: HTMLElement
  readonly onSend: Stream.Stream<string, never, never>
  readonly setMessages: (messages: ReadonlyArray<ChatPanelEntry>) => Effect.Effect<void, never>
  readonly setConnected: (connected: boolean) => Effect.Effect<void, never>
  readonly show: Effect.Effect<void, never>
  readonly hide: Effect.Effect<void, never>
}

const PANEL_STYLES = `
  position: fixed;
  left: 18px;
  bottom: 18px;
  display: none;
  flex-direction: column;
  width: min(360px, calc(100vw - 36px));
  max-height: min(320px, 45vh);
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 12px;
  background: linear-gradient(145deg, rgba(18, 22, 28, 0.92), rgba(8, 10, 14, 0.82));
  color: #f3f6f8;
  font: 13px/1.4 "Trebuchet MS", "Verdana", sans-serif;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.36);
  pointer-events: auto;
  z-index: 1300;
`

const HEADER_STYLES = `
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 700;
  letter-spacing: 0.02em;
`

const STATUS_STYLES = `
  color: rgba(243, 246, 248, 0.64);
  font-size: 11px;
  font-weight: 500;
`

const MESSAGE_LIST_STYLES = `
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 74px;
  max-height: 190px;
  overflow-y: auto;
  padding: 8px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.26);
`

const FORM_STYLES = `
  display: flex;
  gap: 6px;
`

const INPUT_STYLES = `
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: #f3f6f8;
  outline: none;
`

const BUTTON_STYLES = `
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: #7fb069;
  color: #101510;
  font-weight: 700;
  cursor: pointer;
`

const EMPTY_MESSAGE = 'No chat messages yet'

const clearChildren = (element: HTMLElement): void => {
  while (element.firstChild !== null) element.removeChild(element.firstChild)
}

const appendToMultiplayerRoot = (dom: DomOperationsService, element: HTMLElement): void => {
  const root = typeof document === 'undefined' ? null : document.getElementById('multiplayer-root')
  if (root instanceof HTMLElement) dom.appendChildTo(root, element)
  else dom.appendChild(element)
}

const renderEmptyMessage = (dom: DomOperationsService, messages: HTMLElement): void => {
  const empty = dom.createElement('div')
  empty.className = 'mp-chat-empty'
  empty.textContent = EMPTY_MESSAGE
  empty.style.cssText = 'color: rgba(243, 246, 248, 0.58); font-style: italic;'
  dom.appendChildTo(messages, empty)
}

export class ChatPanelService extends Effect.Service<ChatPanelService>()(
  '@minecraft/presentation/ChatPanel',
  {
    scoped: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      const sendQueue = yield* Queue.unbounded<string>()
      let connected = false

      const element = dom.createElement('section')
      element.className = 'mp-chat-panel'
      element.style.cssText = PANEL_STYLES

      const header = dom.createElement('div')
      header.className = 'mp-chat-header'
      header.style.cssText = HEADER_STYLES
      const title = dom.createElement('span')
      title.textContent = 'Chat'
      const status = dom.createElement('span')
      status.className = 'mp-chat-status'
      status.style.cssText = STATUS_STYLES
      status.textContent = 'Disconnected'
      dom.appendChildTo(header, title)
      dom.appendChildTo(header, status)

      const messages = dom.createElement('div')
      messages.className = 'mp-chat-messages'
      messages.style.cssText = MESSAGE_LIST_STYLES
      renderEmptyMessage(dom, messages)

      const form = dom.createElement('div')
      form.className = 'mp-chat-form'
      form.style.cssText = FORM_STYLES

      const input = dom.createElement('input')
      input.className = 'mp-chat-input'
      input.type = 'text'
      input.placeholder = 'Connect to multiplayer first'
      input.autocomplete = 'off'
      input.disabled = true
      input.style.cssText = INPUT_STYLES

      const button = dom.createElement('button')
      button.className = 'mp-chat-send'
      button.type = 'button'
      button.textContent = 'Send'
      button.disabled = true
      button.style.cssText = BUTTON_STYLES

      dom.appendChildTo(form, input)
      dom.appendChildTo(form, button)
      dom.appendChildTo(element, header)
      dom.appendChildTo(element, messages)
      dom.appendChildTo(element, form)
      appendToMultiplayerRoot(dom, element)

      const sendCurrentMessage = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          if (!connected) return
          const text = input.value.trim()
          if (text.length === 0) return
          input.value = ''
          yield* Queue.offer(sendQueue, text)
        })

      button.addEventListener('click', () => {
        Effect.runFork(sendCurrentMessage())
      })
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        Effect.runFork(sendCurrentMessage())
      })

      yield* Effect.addFinalizer(() => Effect.sync(() => dom.removeChild(element)))

      return {
        element,
        onSend: Stream.fromQueue(sendQueue),

        setMessages: (entries: ReadonlyArray<ChatPanelEntry>): Effect.Effect<void, never> =>
          Effect.sync(() => {
            clearChildren(messages)
            if (entries.length === 0) {
              renderEmptyMessage(dom, messages)
              return
            }

            for (const entry of entries) {
              const row = dom.createElement('div')
              row.className = 'mp-chat-message'
              row.textContent = `${entry.player}: ${entry.text}`
              row.style.cssText = 'overflow-wrap: anywhere;'
              dom.appendChildTo(messages, row)
            }
            messages.scrollTop = messages.scrollHeight
          }),

        setConnected: (nextConnected: boolean): Effect.Effect<void, never> =>
          Effect.sync(() => {
            connected = nextConnected
            input.disabled = !nextConnected
            button.disabled = !nextConnected
            input.placeholder = nextConnected ? 'Message multiplayer...' : 'Connect to multiplayer first'
            status.textContent = nextConnected ? 'Connected' : 'Disconnected'
          }),

        show: Effect.sync(() => {
          element.style.display = 'flex'
        }),

        hide: Effect.sync(() => {
          element.style.display = 'none'
        }),
      }
    }),
  }
) {}
