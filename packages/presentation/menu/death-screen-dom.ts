import { Option } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { BACKDROP_STYLE, BUTTON_STYLE, PANEL_STYLE, TITLE_STYLE } from './death-screen-styles'
import type { DeathScreenDom } from './death-screen-types'

export const buildDeathScreenDOM = (dom: DomOperationsService): DeathScreenDom => {
  if (typeof document === 'undefined') {
    return { backdropEl: Option.none(), respawnBtn: Option.none(), quitBtn: Option.none() }
  }

  const backdrop = dom.createElement('div')
  backdrop.id = 'death-screen-backdrop'
  backdrop.style.cssText = BACKDROP_STYLE

  const panel = dom.createElement('div')
  panel.style.cssText = PANEL_STYLE
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-label', 'Death Screen')

  const title = dom.createElement('div')
  title.textContent = 'YOU DIED'
  title.style.cssText = TITLE_STYLE
  dom.appendChildTo(panel, title)

  const respawnBtn = dom.createElement('button')
  respawnBtn.textContent = 'Respawn'
  respawnBtn.style.cssText = BUTTON_STYLE
  respawnBtn.dataset['role'] = 'respawn'
  dom.appendChildTo(panel, respawnBtn)

  const quitBtn = dom.createElement('button')
  quitBtn.textContent = 'Quit to Title'
  quitBtn.style.cssText = BUTTON_STYLE
  quitBtn.dataset['role'] = 'quit-to-title'
  dom.appendChildTo(panel, quitBtn)

  dom.appendChildTo(backdrop, panel)
  dom.appendChild(backdrop)

  return {
    backdropEl: Option.some(backdrop),
    respawnBtn: Option.some(respawnBtn),
    quitBtn: Option.some(quitBtn),
  }
}
