import { Cause, Effect, Queue, Ref, Stream } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'

export interface ChatPanelMessage {
  readonly player: string
  readonly text: string
  readonly timestamp: number
}

export interface ChatPanel {
  readonly element: HTMLElement
  readonly onSend: Stream.Stream<string, never, never>
  readonly show: Effect.Effect<void, never>
  readonly hide: Effect.Effect<void, never>
  readonly setConnected: (connected: boolean) => Effect.Effect<void, never>
  readonly setMessages: (messages: ReadonlyArray<ChatPanelMessage>) => Effect.Effect<void, never>
}

const panelStyle = [
  'position:fixed', 'left:16px', 'bottom:16px', 'z-index:1200',
  'display:none', 'flex-direction:column', 'gap:8px', 'width:min(380px,calc(100vw - 32px))',
  'padding:12px', 'background:rgba(0,0,0,0.72)', 'color:#fff',
  'border-radius:8px', 'font-family:monospace', 'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
  'pointer-events:auto',
].join(';')

const messageListStyle = [
  'display:flex', 'flex-direction:column', 'gap:4px', 'min-height:90px', 'max-height:180px',
  'overflow-y:auto', 'font-size:12px', 'line-height:1.35',
].join(';')

const formStyle = ['display:flex', 'gap:6px', 'align-items:center'].join(';')

const inputStyle = [
  'flex:1', 'min-width:0', 'padding:8px 10px', 'background:#1d1d1d', 'color:#fff',
  'border:1px solid #555', 'border-radius:4px', 'font-family:monospace',
].join(';')

const buttonStyle = [
  'padding:8px 10px', 'cursor:pointer', 'background:#3a5a8a',
  'border:2px solid transparent', 'border-radius:4px', 'color:#fff',
  'font-family:monospace', 'font-size:12px',
].join(';')

const appendPanel = (dom: DomOperationsService, element: HTMLElement): void => {
  const root = typeof document === 'undefined' ? null : document.getElementById('multiplayer-root')
  if (root instanceof HTMLElement) dom.appendChildTo(root, element)
  else dom.appendChild(element)
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable
}

const isChatOpenKey = (event: KeyboardEvent): boolean =>
  event.code === 'KeyT' || event.key.toLowerCase() === 't'

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '--:--'
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

const makeMessageElement = (dom: DomOperationsService, message: ChatPanelMessage): HTMLElement => {
  const row = dom.createElement('div')
  row.className = 'mp-chat-message'
  row.style.cssText = 'display:flex;gap:6px;align-items:baseline;word-break:break-word'

  const time = dom.createElement('span')
  time.className = 'mp-chat-time'
  time.textContent = `[${formatTimestamp(message.timestamp)}]`
  time.style.cssText = 'opacity:0.65;flex:0 0 auto'

  const player = dom.createElement('span')
  player.className = 'mp-chat-player'
  player.textContent = `<${message.player}>`
  player.style.cssText = 'color:#8fd0ff;flex:0 0 auto'

  const text = dom.createElement('span')
  text.className = 'mp-chat-text'
  text.textContent = message.text

  dom.appendChildTo(row, time)
  dom.appendChildTo(row, player)
  dom.appendChildTo(row, text)
  return row
}

export const makeChatPanel = (dom: DomOperationsService) =>
  Effect.gen(function* () {
    const sendQueue = yield* Queue.unbounded<string>()
    const connectedRef = yield* Ref.make(false)
    let isOpen = false

    const element = dom.createElement('section')
    element.id = 'multiplayer-chat-panel'
    element.className = 'multiplayer-chat-panel'
    element.style.cssText = panelStyle
    element.setAttribute('aria-hidden', 'true')
    element.setAttribute('aria-label', 'Multiplayer chat')

    const status = dom.createElement('div')
    status.className = 'mp-chat-status'
    status.textContent = 'Connect to a server to chat'
    status.style.cssText = 'font-size:11px;opacity:0.78;min-height:14px'
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')

    const messages = dom.createElement('div')
    messages.className = 'mp-chat-messages'
    messages.style.cssText = messageListStyle
    messages.setAttribute('role', 'log')
    messages.setAttribute('aria-live', 'polite')
    messages.setAttribute('aria-relevant', 'additions text')
    messages.setAttribute('aria-label', 'Multiplayer chat messages')

    const form = dom.createElement('form')
    form.className = 'mp-chat-form'
    form.style.cssText = formStyle

    const input = dom.createElement('input')
    input.id = 'mp-chat-input'
    input.className = 'mp-chat-input'
    input.type = 'text'
    input.placeholder = 'Type chat message...'
    input.disabled = true
    input.style.cssText = inputStyle
    input.setAttribute('aria-label', 'Chat message')
    input.setAttribute('aria-disabled', 'true')
    input.setAttribute('autocomplete', 'off')

    const button = dom.createElement('button')
    button.type = 'submit'
    button.className = 'mp-chat-send'
    button.textContent = 'Send'
    button.disabled = true
    button.style.cssText = buttonStyle
    button.setAttribute('aria-label', 'Send chat message')
    button.setAttribute('aria-disabled', 'true')

    dom.appendChildTo(form, input)
    dom.appendChildTo(form, button)
    dom.appendChildTo(element, status)
    dom.appendChildTo(element, messages)
    dom.appendChildTo(element, form)

    const focusInput = () => {
      if (input.disabled) return
      const focus = (input as HTMLInputElement & { focus?: () => void }).focus
      if (typeof focus === 'function') focus.call(input)
    }

    const blurInput = () => {
      const blur = (input as HTMLInputElement & { blur?: () => void }).blur
      if (typeof blur === 'function') blur.call(input)
    }

    const openPanel = () => {
      isOpen = true
      element.style.display = 'flex'
      element.setAttribute('aria-hidden', 'false')
      focusInput()
    }

    const closePanel = () => {
      isOpen = false
      element.style.display = 'none'
      element.setAttribute('aria-hidden', 'true')
      blurInput()
    }

    const handleSubmit = (event: Event) => {
      event.preventDefault()
      Effect.runFork(Effect.gen(function* () {
        const connected = yield* Ref.get(connectedRef)
        const text = input.value.trim()
        if (!connected || text.length === 0) return
        yield* Queue.offer(sendQueue, text)
        yield* Effect.sync(() => {
          input.value = ''
          closePanel()
        })
      }).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Chat panel submit error: ${Cause.pretty(cause)}`)),
      ))
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isChatOpenKey(event) && !isOpen && !isEditableTarget(event.target)) {
        event.preventDefault()
        event.stopPropagation()
        openPanel()
        return
      }

      if (event.key === 'Escape' && isOpen) {
        event.preventDefault()
        event.stopPropagation()
        closePanel()
      }
    }
    const keydownTarget = typeof document === 'undefined' ? null : document

    const panel: ChatPanel = {
      element,
      onSend: Stream.fromQueue(sendQueue),
      show: Effect.sync(openPanel),
      hide: Effect.sync(closePanel),
      setConnected: (connected) => Effect.gen(function* () {
        yield* Ref.set(connectedRef, connected)
        yield* Effect.sync(() => {
          input.disabled = !connected
          button.disabled = !connected
          input.setAttribute('aria-disabled', String(!connected))
          button.setAttribute('aria-disabled', String(!connected))
          status.textContent = connected ? 'Chat ready' : 'Connect to a server to chat'
          if (connected && isOpen) focusInput()
        })
      }),
      setMessages: (snapshot) => Effect.sync(() => {
        dom.setInnerHTML(messages, '')
        for (const message of snapshot.slice(-50)) dom.appendChildTo(messages, makeMessageElement(dom, message))
        messages.scrollTop = messages.scrollHeight
      }),
    }

    yield* Effect.sync(() => {
      appendPanel(dom, element)
      form.addEventListener('submit', handleSubmit)
      keydownTarget?.addEventListener('keydown', handleKeyDown, true)
    })
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        form.removeEventListener('submit', handleSubmit)
        keydownTarget?.removeEventListener('keydown', handleKeyDown, true)
        dom.removeChild(element)
      }),
    )
    return panel
  })

export class ChatPanelService extends Effect.Service<ChatPanelService>()(
  '@minecraft/presentation/ChatPanel',
  {
    scoped: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      return yield* makeChatPanel(dom)
    }),
  },
) {}
