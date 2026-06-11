import { Option } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { BACKDROP_STYLE, BUTTON_STYLE, PANEL_STYLE, TITLE_STYLE } from './pause-menu-styles'
import type { PauseMenuDom } from './pause-menu-types'

export const buildPauseMenuDOM = (dom: DomOperationsService): PauseMenuDom => {
  if (typeof document === 'undefined') {
    return {
      backdropEl: Option.none(),
      resumeBtn: Option.none(),
      settingsBtn: Option.none(),
      saveQuitBtn: Option.none(),
    }
  }

  const backdrop = dom.createElement('div')
  backdrop.id = 'pause-menu-backdrop'
  backdrop.style.cssText = BACKDROP_STYLE

  const panel = dom.createElement('div')
  panel.style.cssText = PANEL_STYLE
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-label', 'Pause Menu')

  const title = dom.createElement('div')
  title.textContent = 'PAUSED'
  title.style.cssText = TITLE_STYLE
  dom.appendChildTo(panel, title)

  const resumeBtn = dom.createElement('button')
  resumeBtn.textContent = 'Resume'
  resumeBtn.style.cssText = BUTTON_STYLE
  resumeBtn.dataset['role'] = 'resume'
  dom.appendChildTo(panel, resumeBtn)

  const settingsBtn = dom.createElement('button')
  settingsBtn.textContent = 'Settings'
  settingsBtn.style.cssText = BUTTON_STYLE
  settingsBtn.dataset['role'] = 'settings'
  dom.appendChildTo(panel, settingsBtn)

  const saveQuitBtn = dom.createElement('button')
  saveQuitBtn.textContent = 'Save & Quit to Title'
  saveQuitBtn.style.cssText = BUTTON_STYLE
  saveQuitBtn.dataset['role'] = 'save-quit'
  dom.appendChildTo(panel, saveQuitBtn)

  dom.appendChildTo(backdrop, panel)
  dom.appendChild(backdrop)

  return {
    backdropEl: Option.some(backdrop),
    resumeBtn: Option.some(resumeBtn),
    settingsBtn: Option.some(settingsBtn),
    saveQuitBtn: Option.some(saveQuitBtn),
  }
}
