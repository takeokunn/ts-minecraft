import { Effect } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import type { RemotePlayerSnapshot } from '@ts-minecraft/app/application/multiplayer/multiplayer-service'

export interface PlayerListPanel {
  readonly element: HTMLElement
  readonly show: Effect.Effect<void, never>
  readonly hide: Effect.Effect<void, never>
  readonly isOpen: () => Effect.Effect<boolean, never>
  readonly setPlayers: (players: ReadonlyArray<RemotePlayerSnapshot>) => Effect.Effect<void, never>
}

const panelStyle = [
  'position:fixed', 'right:16px', 'top:16px', 'z-index:1200',
  'display:none', 'flex-direction:column', 'gap:10px',
  'min-width:min(320px,calc(100vw - 32px))', 'max-width:min(420px,calc(100vw - 32px))',
  'max-height:min(55vh,calc(100vh - 32px))', 'padding:12px',
  'background:rgba(10,10,18,0.78)', 'color:#fff', 'border-radius:10px',
  'font-family:monospace', 'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
  'pointer-events:auto', 'backdrop-filter:blur(6px)',
].join(';')

const headerStyle = ['display:flex', 'flex-direction:column', 'gap:4px'].join(';')

const listStyle = [
  'display:flex', 'flex-direction:column', 'gap:6px', 'overflow-y:auto',
  'font-size:12px', 'line-height:1.4', 'padding-right:2px',
].join(';')

const itemStyle = [
  'display:flex', 'justify-content:space-between', 'gap:12px',
  'padding:8px 10px', 'border-radius:6px', 'background:rgba(255,255,255,0.06)',
].join(';')

const nameStyle = ['color:#8fd0ff', 'font-weight:700', 'overflow:hidden', 'text-overflow:ellipsis', 'white-space:nowrap'].join(';')

const metaStyle = ['opacity:0.82', 'white-space:nowrap', 'flex:0 0 auto'].join(';')

const appendPanel = (dom: DomOperationsService, element: HTMLElement): void => {
  const root = typeof document === 'undefined' ? null : document.getElementById('multiplayer-root')
  if (root instanceof HTMLElement) dom.appendChildTo(root, element)
  else dom.appendChild(element)
}

const formatCoordinate = (value: number): string =>
  Number.isFinite(value) ? value.toFixed(1) : '0.0'

const makePlayerRow = (dom: DomOperationsService, player: RemotePlayerSnapshot): HTMLElement => {
  const row = dom.createElement('div')
  row.className = 'mp-player-row'
  row.style.cssText = itemStyle

  const name = dom.createElement('span')
  name.className = 'mp-player-name'
  name.textContent = player.playerName
  name.style.cssText = nameStyle

  const meta = dom.createElement('span')
  meta.className = 'mp-player-meta'
  meta.textContent = `x:${formatCoordinate(player.x)} y:${formatCoordinate(player.y)} z:${formatCoordinate(player.z)}`
  meta.style.cssText = metaStyle

  dom.appendChildTo(row, name)
  dom.appendChildTo(row, meta)
  return row
}

export const makePlayerListPanel = (dom: DomOperationsService) =>
  Effect.gen(function* () {
    let isOpen = false

    const element = dom.createElement('section')
    element.id = 'multiplayer-player-list-panel'
    element.className = 'multiplayer-player-list-panel'
    element.style.cssText = panelStyle
    element.setAttribute('aria-hidden', 'true')
    element.setAttribute('aria-label', 'Multiplayer player list')

    const header = dom.createElement('div')
    header.className = 'mp-player-list-header'
    header.style.cssText = headerStyle

    const title = dom.createElement('strong')
    title.className = 'mp-player-list-title'
    title.textContent = 'Players online'

    const subtitle = dom.createElement('span')
    subtitle.className = 'mp-player-list-subtitle'
    subtitle.textContent = 'Tab to hide this panel'
    subtitle.style.cssText = 'font-size:11px;opacity:0.72'

    const count = dom.createElement('div')
    count.className = 'mp-player-list-count'
    count.textContent = '0 players'
    count.style.cssText = 'font-size:12px;opacity:0.82'
    count.setAttribute('role', 'status')
    count.setAttribute('aria-live', 'polite')

    const list = dom.createElement('div')
    list.className = 'mp-player-list'
    list.style.cssText = listStyle
    list.setAttribute('role', 'list')
    list.setAttribute('aria-label', 'Connected players')

    dom.appendChildTo(header, title)
    dom.appendChildTo(header, subtitle)
    dom.appendChildTo(element, header)
    dom.appendChildTo(element, count)
    dom.appendChildTo(element, list)

    const openPanel = () => {
      isOpen = true
      element.style.display = 'flex'
      element.setAttribute('aria-hidden', 'false')
    }

    const closePanel = () => {
      isOpen = false
      element.style.display = 'none'
      element.setAttribute('aria-hidden', 'true')
    }

    const panel: PlayerListPanel = {
      element,
      show: Effect.sync(openPanel),
      hide: Effect.sync(closePanel),
      isOpen: () => Effect.sync(() => isOpen),
      setPlayers: (players) => Effect.sync(() => {
        dom.setInnerHTML(list, '')
        for (const player of players) dom.appendChildTo(list, makePlayerRow(dom, player))
        count.textContent = players.length === 1 ? '1 player' : `${players.length} players`
      }),
    }

    yield* Effect.sync(() => {
      appendPanel(dom, element)
    })
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        dom.removeChild(element)
      }),
    )
    return panel
  })

export class PlayerListPanelService extends Effect.Service<PlayerListPanelService>()(
  '@minecraft/presentation/PlayerListPanel',
  {
    scoped: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      return yield* makePlayerListPanel(dom)
    }),
  },
) {}
