import { Cause, Effect, Queue, Ref, Stream } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'

export interface ConnectionRequest {
  readonly serverUrl: string
  readonly playerName: string
}

export interface ConnectionPanel {
  readonly element: HTMLElement
  readonly setStatus: (status: string) => Effect.Effect<void, never>
  readonly onConnect: Stream.Stream<ConnectionRequest, never, never>
  readonly onDisconnect: Stream.Stream<void, never, never>
  readonly show: Effect.Effect<void, never>
  readonly hide: Effect.Effect<void, never>
  readonly setConnected: (connected: boolean) => Effect.Effect<void, never>
}

const panelStyle = [
  'position:fixed', 'top:10px', 'right:10px', 'z-index:1200',
  'display:none', 'flex-direction:column', 'gap:8px', 'min-width:280px',
  'padding:16px', 'background:rgba(0,0,0,0.78)', 'color:#fff',
  'border-radius:8px', 'font-family:monospace', 'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
].join(';')

const inputStyle = [
  'padding:8px 10px', 'background:#222', 'color:#fff',
  'border:1px solid #555', 'border-radius:4px', 'font-family:monospace',
].join(';')

const buttonStyle = [
  'padding:10px 12px', 'cursor:pointer', 'background:#3a5a8a',
  'border:2px solid transparent', 'border-radius:4px', 'color:#fff',
  'font-family:monospace', 'font-size:14px',
].join(';')

const makeInput = (
  dom: DomOperationsService,
  id: string,
  labelText: string,
  placeholder: string,
): HTMLInputElement => {
  const label = dom.createElement('label')
  label.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-size:13px'
  const caption = dom.createElement('span')
  caption.textContent = labelText
  const input = dom.createElement('input')
  input.id = id
  input.className = 'mp-input'
  input.type = 'text'
  input.placeholder = placeholder
  input.style.cssText = inputStyle
  input.setAttribute('aria-label', labelText)
  dom.appendChildTo(label, caption)
  dom.appendChildTo(label, input)
  return input
}

const appendPanel = (dom: DomOperationsService, element: HTMLElement): void => {
  const root = typeof document === 'undefined' ? null : document.getElementById('multiplayer-root')
  if (root instanceof HTMLElement) dom.appendChildTo(root, element)
  else dom.appendChild(element)
}

const resolveInitialServerUrl = (): string => {
  const env = (import.meta as ImportMeta & { env?: { readonly VITE_WS_URL?: string } }).env
  return env?.VITE_WS_URL?.trim() ?? ''
}

export const makeConnectionPanel = (dom: DomOperationsService, initialServerUrl = resolveInitialServerUrl()) =>
  Effect.gen(function* () {
    const connectQueue = yield* Queue.unbounded<ConnectionRequest>()
    const disconnectQueue = yield* Queue.unbounded<void>()
    const connectedRef = yield* Ref.make(false)

    const element = dom.createElement('div')
    element.id = 'multiplayer-connection-panel'
    element.className = 'multiplayer-connection-panel'
    element.style.cssText = panelStyle
    element.setAttribute('aria-hidden', 'true')
    element.setAttribute('aria-label', 'Multiplayer connection')

    const serverInput = makeInput(dom, 'mp-server-url', 'Server URL', 'ws://localhost:8080')
    serverInput.setAttribute('autocomplete', 'url')
    if (initialServerUrl.length > 0) serverInput.value = initialServerUrl
    const playerInput = makeInput(dom, 'mp-player-name', 'Player name', 'Steve')
    playerInput.setAttribute('autocomplete', 'nickname')
    const button = dom.createElement('button')
    button.type = 'button'
    button.className = 'mp-button'
    button.textContent = 'Connect'
    button.style.cssText = buttonStyle
    button.setAttribute('aria-label', 'Connect to multiplayer server')
    const status = dom.createElement('div')
    status.className = 'mp-status'
    status.textContent = 'Disconnected'
    status.style.cssText = 'font-size:12px;opacity:0.9;min-height:16px'
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')

    dom.appendChildTo(element, serverInput.parentElement ?? serverInput)
    dom.appendChildTo(element, playerInput.parentElement ?? playerInput)
    dom.appendChildTo(element, button)
    dom.appendChildTo(element, status)

    const handleClick = () => {
      Effect.runFork(Effect.gen(function* () {
        const connected = yield* Ref.get(connectedRef)
        if (connected) {
          yield* Queue.offer(disconnectQueue, undefined)
          return
        }

        const serverUrl = serverInput.value.trim()
        if (serverUrl.length === 0) {
          yield* Effect.sync(() => {
            status.textContent = 'Server URL is required'
          })
          return
        }

        yield* Queue.offer(connectQueue, {
          serverUrl,
          playerName: playerInput.value.trim(),
        })
      }).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Connection panel click error: ${Cause.pretty(cause)}`)),
      ))
    }

    const panel: ConnectionPanel = {
      element,
      setStatus: (text) => Effect.sync(() => { status.textContent = text }),
      onConnect: Stream.fromQueue(connectQueue),
      onDisconnect: Stream.fromQueue(disconnectQueue),
      show: Effect.sync(() => {
        element.style.display = 'flex'
        element.setAttribute('aria-hidden', 'false')
      }),
      hide: Effect.sync(() => {
        element.style.display = 'none'
        element.setAttribute('aria-hidden', 'true')
      }),
      setConnected: (connected) => Effect.gen(function* () {
        yield* Ref.set(connectedRef, connected)
        yield* Effect.sync(() => {
          serverInput.disabled = connected
          playerInput.disabled = connected
          serverInput.setAttribute('aria-disabled', String(connected))
          playerInput.setAttribute('aria-disabled', String(connected))
          button.textContent = connected ? 'Disconnect' : 'Connect'
          button.setAttribute(
            'aria-label',
            connected ? 'Disconnect from multiplayer server' : 'Connect to multiplayer server',
          )
        })
      }),
    }

    yield* Effect.sync(() => {
      appendPanel(dom, element)
      button.addEventListener('click', handleClick)
    })
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        button.removeEventListener('click', handleClick)
        dom.removeChild(element)
      }),
    )
    return panel
  })

export class ConnectionPanelService extends Effect.Service<ConnectionPanelService>()(
  '@minecraft/presentation/ConnectionPanel',
  {
    scoped: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      return yield* makeConnectionPanel(dom)
    }),
  },
) {}
