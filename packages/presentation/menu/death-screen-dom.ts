import { Option } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { BACKDROP_STYLE, BUTTON_STYLE, HELP_STYLE, MESSAGE_STYLE, PANEL_STYLE, TITLE_STYLE } from './death-screen-styles'
import type { DeathScreenDom } from './death-screen-types'

export const buildDeathScreenDOM = (dom: DomOperationsService): DeathScreenDom => {
  if (typeof document === 'undefined') {
    return {
      backdropEl: Option.none(),
      messageEl: Option.none(),
      respawnBtn: Option.none(),
      quitBtn: Option.none(),
    }
  }

  const backdrop = dom.createElement('div')
  backdrop.id = 'death-screen-backdrop'
  backdrop.style.cssText = BACKDROP_STYLE

  const panel = dom.createElement('div')
  panel.style.cssText = PANEL_STYLE
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-labelledby', 'death-screen-title')
  panel.setAttribute('aria-describedby', 'death-screen-message death-screen-help')

  const title = dom.createElement('div')
  title.id = 'death-screen-title'
  title.textContent = 'YOU DIED'
  title.style.cssText = TITLE_STYLE
  dom.appendChildTo(panel, title)

  const message = dom.createElement('div')
  message.id = 'death-screen-message'
  message.textContent = 'You died.'
  message.style.cssText = MESSAGE_STYLE
  message.dataset['role'] = 'death-message'
  message.setAttribute('aria-live', 'polite')
  dom.appendChildTo(panel, message)

  const help = dom.createElement('p')
  help.id = 'death-screen-help'
  help.textContent = [
    'Respawn returns you to your current spawn point.',
    'Press Enter or Esc to respawn; press Tab to choose Quit to Title.',
  ].join(' ')
  help.style.cssText = HELP_STYLE
  dom.appendChildTo(panel, help)

  const respawnBtn = dom.createElement('button')
  respawnBtn.textContent = 'Respawn'
  respawnBtn.style.cssText = BUTTON_STYLE
  respawnBtn.dataset['role'] = 'respawn'
  respawnBtn.setAttribute('aria-label', 'Respawn at your current spawn point')
  dom.appendChildTo(panel, respawnBtn)

  const quitBtn = dom.createElement('button')
  quitBtn.textContent = 'Quit to Title'
  quitBtn.style.cssText = BUTTON_STYLE
  quitBtn.dataset['role'] = 'quit-to-title'
  quitBtn.setAttribute('aria-label', 'Quit to title screen')
  dom.appendChildTo(panel, quitBtn)

  dom.appendChildTo(backdrop, panel)
  dom.appendChild(backdrop)

  return {
    backdropEl: Option.some(backdrop),
    messageEl: Option.some(message),
    respawnBtn: Option.some(respawnBtn),
    quitBtn: Option.some(quitBtn),
  }
}
