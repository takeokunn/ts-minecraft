import { Option } from 'effect'
import type { WorldMetadata } from '@ts-minecraft/world'
import { WorldId } from '@ts-minecraft/core'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { overlayBaseStyle, cardStyle, buttonStyle, dangerButtonStyle, inputStyle, menuButtonHoverCss } from './main-menu-styles'
import { formatLastPlayed, gameModeLabel } from './main-menu-utils'

// --- Shared types ---

export interface MenuButtons {
  readonly newWorld: HTMLButtonElement
  readonly continueWorld: HTMLButtonElement
  readonly loadWorld: HTMLButtonElement
  readonly multiplayer: HTMLButtonElement
  readonly howToPlay: HTMLButtonElement
  readonly settings: HTMLButtonElement
  readonly nwName: HTMLInputElement
  readonly nwSeed: HTMLInputElement
  readonly nwMode: HTMLButtonElement
  readonly nwCancel: HTMLButtonElement
  readonly nwConfirm: HTMLButtonElement
  readonly lwList: HTMLDivElement
  readonly lwBack: HTMLButtonElement
  readonly mpServerUrl: HTMLInputElement
  readonly mpPlayerName: HTMLInputElement
  readonly mpCancel: HTMLButtonElement
  readonly mpConfirm: HTMLButtonElement
  readonly howToPlayClose: HTMLButtonElement
}

export interface MenuDomElements {
  readonly overlay: HTMLDivElement
  readonly rootCard: HTMLDivElement
  readonly newWorldCard: HTMLDivElement
  readonly loadWorldCard: HTMLDivElement
  readonly multiplayerCard: HTMLDivElement
  readonly howToPlayCard: HTMLDivElement
  readonly buttons: MenuButtons
}

// --- DOM build ---

export const buildMenuDOM = (dom: DomOperationsService): MenuDomElements => {
  const overlay = dom.createElement('div') as HTMLDivElement
  overlay.id = 'main-menu-overlay'
  overlay.style.cssText = `${overlayBaseStyle};display:none`
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', 'Main Menu')

  // Hover/focus styling for the bevelled buttons lives in a scoped <style> because
  // inline styles can't express pseudo-classes. Kept inside the overlay so it is
  // torn down with it, and so we don't add a second document-level appendChild.
  const styleEl = dom.createElement('style') as HTMLStyleElement
  dom.setInnerHTML(styleEl, menuButtonHoverCss)
  overlay.appendChild(styleEl)

  // ROOT card
  const rootCard = dom.createElement('div') as HTMLDivElement
  rootCard.id = 'main-menu-root'
  rootCard.style.cssText = `${cardStyle};max-height:calc(100vh - 32px);overflow-y:auto`
  dom.setInnerHTML(rootCard, `
    <h1 style="margin:0 0 18px;text-align:center;font-size:40px;font-weight:900;letter-spacing:3px;color:#fff;text-shadow:2px 2px 0 #3f3f3f;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">ts-minecraft</h1>
    <p style="margin:-4px 0 4px;font-size:14px;line-height:1.45;text-align:center">
      Pick a world, continue your latest save, or open the controls guide before you start.
    </p>
    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:4px;font-size:12px;line-height:1.35;color:#c8c8c8;text-align:center">
      <span>Keyboard, mouse, and gamepad are supported.</span>
      <span>Touch controls are not available yet.</span>
    </div>
      <button type="button" id="mm-new-world" class="mc-menu-btn" style="${buttonStyle}">Create New World</button>
      <button type="button" id="mm-continue-world" class="mc-menu-btn" style="${buttonStyle}">Continue Last World</button>
      <button type="button" id="mm-load-world" class="mc-menu-btn" style="${buttonStyle}">Select World</button>
      <button type="button" id="mm-multiplayer" class="mc-menu-btn" style="${buttonStyle}">Multiplayer...</button>
      <button type="button" id="mm-how-to-play" class="mc-menu-btn" style="${buttonStyle}">How to Play</button>
      <button type="button" id="mm-settings" class="mc-menu-btn" style="${buttonStyle}">Options...</button>
    `)

  // NEW_WORLD card
  const newWorldCard = dom.createElement('div') as HTMLDivElement
  newWorldCard.id = 'main-menu-new-world'
  newWorldCard.style.cssText = `${cardStyle};max-height:calc(100vh - 32px);overflow-y:auto;display:none`
  dom.setInnerHTML(newWorldCard, `
    <h2 style="margin:0 0 8px;font-size:20px">Create New World</h2>
    <p style="margin:0 0 4px;font-size:13px;line-height:1.45">
      Name the world, choose a starting mode, and confirm to generate the save.
    </p>
    <label style="display:flex;flex-direction:column;gap:4px">
      <span>World name</span>
      <input type="text" id="mm-nw-name" style="${inputStyle}" placeholder="My World" />
    </label>
    <label style="display:flex;flex-direction:column;gap:4px">
      <span>Seed (optional)</span>
      <input type="text" id="mm-nw-seed" style="${inputStyle}" placeholder="Leave blank for random" />
    </label>
    <label style="display:flex;flex-direction:column;gap:4px">
      <span>Game mode</span>
      <button type="button" id="mm-nw-mode" class="mc-menu-btn" style="${buttonStyle}">Survival</button>
    </label>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button type="button" id="mm-nw-cancel" class="mc-menu-btn" style="${buttonStyle};flex:1">Cancel</button>
      <button type="button" id="mm-nw-confirm" class="mc-menu-btn" style="${buttonStyle};flex:1">Confirm</button>
    </div>
  `)

  // LOAD_WORLD card
  const loadWorldCard = dom.createElement('div') as HTMLDivElement
  loadWorldCard.id = 'main-menu-load-world'
  loadWorldCard.style.cssText = `${cardStyle};width:min(560px,calc(100vw - 32px));max-height:80vh;display:none`
  dom.setInnerHTML(loadWorldCard, `
    <h2 style="margin:0 0 8px;font-size:20px">Load World</h2>
    <div id="mm-lw-list" style="display:flex;flex-direction:column;gap:8px;min-height:60px;flex:1;overflow-y:auto"></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button type="button" id="mm-lw-back" class="mc-menu-btn" style="${buttonStyle};flex:1">Back</button>
    </div>
    `)

    // MULTIPLAYER card
    const multiplayerCard = dom.createElement('div') as HTMLDivElement
    multiplayerCard.id = 'main-menu-multiplayer'
    multiplayerCard.style.cssText = `${cardStyle};max-height:calc(100vh - 32px);overflow-y:auto;display:none`
    dom.setInnerHTML(multiplayerCard, `
      <h2 style="margin:0 0 8px;font-size:20px">Join Multiplayer</h2>
      <p style="margin:0 0 4px;font-size:13px;line-height:1.45">
        Enter the server address and your player name, then confirm to connect.
      </p>
      <label style="display:flex;flex-direction:column;gap:4px">
        <span>Server URL</span>
        <input type="text" id="mm-mp-server-url" style="${inputStyle}" placeholder="ws://localhost:8080" />
      </label>
      <label style="display:flex;flex-direction:column;gap:4px">
        <span>Player name</span>
        <input type="text" id="mm-mp-player-name" style="${inputStyle}" placeholder="Player" />
      </label>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button type="button" id="mm-mp-cancel" class="mc-menu-btn" style="${buttonStyle};flex:1">Cancel</button>
        <button type="button" id="mm-mp-confirm" class="mc-menu-btn" style="${buttonStyle};flex:1">Confirm</button>
      </div>
    `)

    const howToPlayCard = dom.createElement('div') as HTMLDivElement
    howToPlayCard.id = 'main-menu-how-to-play'
    howToPlayCard.style.cssText = `${cardStyle};width:min(520px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow-y:auto;display:none`
  dom.setInnerHTML(howToPlayCard, `
    <h2 style="margin:0 0 8px;font-size:20px">How to Play</h2>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.45;text-align:left">
        <p style="margin:0"><strong>Controls:</strong> Move with WASD or the left stick, look with the mouse or right stick, jump with Space or a gamepad face button, and click or use triggers to break or place blocks.</p>
        <p style="margin:0"><strong>Input:</strong> Keyboard, mouse, and gamepad are supported. Touch controls are not available yet, so mobile browsers are best used with a paired controller or keyboard.</p>
        <p style="margin:0"><strong>Saving:</strong> Worlds save during play. Use Pause &gt; Save &amp; Quit to Title before leaving.</p>
        <p style="margin:0"><strong>Crafting:</strong> Open your inventory to combine blocks and items into useful recipes.</p>
      <p style="margin:0"><strong>Multiplayer/Chat:</strong> Join a multiplayer session to see other players and use chat to coordinate.</p>
    </div>
    <button type="button" id="mm-how-to-play-close" class="mc-menu-btn" style="${buttonStyle};margin-top:4px">Close</button>
  `)

    overlay.appendChild(rootCard)
    overlay.appendChild(newWorldCard)
    overlay.appendChild(loadWorldCard)
    overlay.appendChild(multiplayerCard)
    overlay.appendChild(howToPlayCard)
    dom.appendChild(overlay)

  const required = <T extends HTMLElement>(parent: HTMLElement, selector: string): T =>
    Option.getOrUndefined(dom.querySelector<T>(parent, selector)) as T

  const buttons: MenuButtons = {
    newWorld: required<HTMLButtonElement>(rootCard, '#mm-new-world'),
    continueWorld: required<HTMLButtonElement>(rootCard, '#mm-continue-world'),
      loadWorld: required<HTMLButtonElement>(rootCard, '#mm-load-world'),
      multiplayer: required<HTMLButtonElement>(rootCard, '#mm-multiplayer'),
      howToPlay: required<HTMLButtonElement>(rootCard, '#mm-how-to-play'),
      settings: required<HTMLButtonElement>(rootCard, '#mm-settings'),
      nwName: required<HTMLInputElement>(newWorldCard, '#mm-nw-name'),
      nwSeed: required<HTMLInputElement>(newWorldCard, '#mm-nw-seed'),
      nwMode: required<HTMLButtonElement>(newWorldCard, '#mm-nw-mode'),
      nwCancel: required<HTMLButtonElement>(newWorldCard, '#mm-nw-cancel'),
      nwConfirm: required<HTMLButtonElement>(newWorldCard, '#mm-nw-confirm'),
      lwList: required<HTMLDivElement>(loadWorldCard, '#mm-lw-list'),
      lwBack: required<HTMLButtonElement>(loadWorldCard, '#mm-lw-back'),
      mpServerUrl: required<HTMLInputElement>(multiplayerCard, '#mm-mp-server-url'),
      mpPlayerName: required<HTMLInputElement>(multiplayerCard, '#mm-mp-player-name'),
      mpCancel: required<HTMLButtonElement>(multiplayerCard, '#mm-mp-cancel'),
      mpConfirm: required<HTMLButtonElement>(multiplayerCard, '#mm-mp-confirm'),
      howToPlayClose: required<HTMLButtonElement>(howToPlayCard, '#mm-how-to-play-close'),
    }

    return { overlay, rootCard, newWorldCard, loadWorldCard, multiplayerCard, howToPlayCard, buttons }
  }

// --- World list row renderers ---

export const rowBaseStyle = [
  'display:flex', 'flex-wrap:wrap', 'align-items:center', 'gap:8px',
  'padding:10px 12px',
  'background:rgba(255,255,255,0.08)', 'border:2px solid #000',
  'box-shadow:inset 2px 2px 0 rgba(255,255,255,0.12),inset -2px -2px 0 rgba(0,0,0,0.4)',
  'color:#e8e8e8', 'text-shadow:1px 1px 0 #1a1a1a',
].join(';')

export const renderValidRow = (
  dom: DomOperationsService,
  lwList: HTMLDivElement,
  worldId: WorldId,
  metadata: WorldMetadata,
  onLoad: () => void,
  onRename: () => void,
  onDelete: () => void,
): void => {
  const row = dom.createElement('div')
  row.style.cssText = rowBaseStyle
  const info = dom.createElement('div')
  info.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:2px;min-width:0'
  const name = dom.createElement('div')
  name.style.cssText = 'font-size:15px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
  name.textContent = metadata.displayName ?? String(worldId)
  const meta = dom.createElement('div')
  meta.style.cssText = 'font-size:12px;opacity:0.8'
  meta.textContent = `Last played: ${formatLastPlayed(metadata.lastPlayed)}`
  info.appendChild(name)
  info.appendChild(meta)
  const badge = dom.createElement('span')
  badge.style.cssText = [
    'padding:2px 8px', 'border:2px solid #111', 'font-size:11px',
    'box-shadow:inset 1px 1px rgba(255,255,255,0.45),inset -1px -1px rgba(0,0,0,0.45)',
    metadata.gameMode === 'creative' ? 'background:#3a5a8a' : metadata.gameMode === 'spectator' ? 'background:#5a3a6a' : 'background:#3a6a3a',
  ].join(';')
  badge.textContent = gameModeLabel(metadata.gameMode)
  const loadBtn = dom.createElement('button')
  loadBtn.type = 'button'
  loadBtn.className = 'mc-menu-btn'
  loadBtn.textContent = 'Load'
  loadBtn.style.cssText = buttonStyle
  loadBtn.addEventListener('click', onLoad)
  const renameBtn = dom.createElement('button')
  renameBtn.type = 'button'
  renameBtn.className = 'mc-menu-btn'
  renameBtn.textContent = 'Rename'
  renameBtn.style.cssText = buttonStyle
  renameBtn.addEventListener('click', onRename)
  const deleteBtn = dom.createElement('button')
  deleteBtn.type = 'button'
  deleteBtn.className = 'mc-menu-btn-danger'
  deleteBtn.textContent = 'Delete'
  deleteBtn.style.cssText = dangerButtonStyle
  deleteBtn.addEventListener('click', onDelete)
  row.appendChild(info)
  row.appendChild(badge)
  row.appendChild(loadBtn)
  row.appendChild(renameBtn)
  row.appendChild(deleteBtn)
  dom.appendChildTo(lwList, row)
}

export const renderCorruptRow = (
  dom: DomOperationsService,
  lwList: HTMLDivElement,
  worldId: WorldId,
  onDelete: () => void,
): void => {
  const row = dom.createElement('div')
  row.style.cssText = `${rowBaseStyle};background:#7a4545`
  const info = dom.createElement('div')
  info.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:2px;min-width:0'
  const name = dom.createElement('div')
  name.style.cssText = 'font-size:15px;font-weight:bold;color:#ffd0d0'
  name.textContent = `Corrupt: ${String(worldId)}`
  const meta = dom.createElement('div')
  meta.style.cssText = 'font-size:12px;opacity:0.8'
  meta.textContent = 'This world failed to decode. Delete to recover.'
  info.appendChild(name)
  info.appendChild(meta)
  const deleteBtn = dom.createElement('button')
  deleteBtn.type = 'button'
  deleteBtn.className = 'mc-menu-btn-danger'
  deleteBtn.textContent = 'Delete'
  deleteBtn.style.cssText = dangerButtonStyle
  deleteBtn.addEventListener('click', onDelete)
  row.appendChild(info)
  row.appendChild(deleteBtn)
  dom.appendChildTo(lwList, row)
}
