import { Option } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { BACKDROP_STYLE, BUTTON_STYLE, PANEL_STYLE, TITLE_STYLE } from './pause-menu-styles'
import type { PauseMenuDom } from './pause-menu-types'

export const buildPauseMenuDOM = (dom: DomOperationsService): PauseMenuDom => {
  if (typeof document === 'undefined') {
    return {
      backdropEl: Option.none(),
      panelEl: Option.none(),
      resumeBtn: Option.none(),
      settingsBtn: Option.none(),
      howToPlayBtn: Option.none(),
      howToPlayPanel: Option.none(),
      howToPlayCloseBtn: Option.none(),
      achievementsBtn: Option.none(),
      achievementsPanel: Option.none(),
      achievementsContentEl: Option.none(),
      achievementsCloseBtn: Option.none(),
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

  const howToPlayBtn = dom.createElement('button')
  howToPlayBtn.textContent = 'How to Play'
  howToPlayBtn.style.cssText = BUTTON_STYLE
  howToPlayBtn.dataset['role'] = 'how-to-play'
  dom.appendChildTo(panel, howToPlayBtn)

  const howToPlayPanel = dom.createElement('div')
  howToPlayPanel.style.cssText = [
    'display:none',
    'background:#9f9f9f',
    'border:2px solid #111',
    'box-shadow:inset 2px 2px #d8d8d8,inset -2px -2px #555',
    'padding:12px',
    'color:#202020',
    'font-size:13px',
    'line-height:1.45',
    'max-width:360px',
    'text-align:left',
  ].join(';')
  howToPlayPanel.setAttribute('role', 'region')
  howToPlayPanel.setAttribute('aria-label', 'How to Play')
  dom.setInnerHTML(howToPlayPanel, `
    <p style="margin:0 0 8px"><strong>Controls:</strong> Move with WASD or the left stick, look with the mouse or right stick, jump with Space or a gamepad face button, and click or use triggers to break or place blocks.</p>
    <p style="margin:0 0 8px"><strong>Input:</strong> Keyboard, mouse, and gamepad are supported. Touch controls are not available yet, so mobile browsers are best used with a paired controller or keyboard.</p>
    <p style="margin:0 0 8px"><strong>Saving:</strong> Worlds save during play. Use Save &amp; Quit to Title before leaving.</p>
    <p style="margin:0 0 8px"><strong>Crafting:</strong> Open your inventory to combine blocks and items into useful recipes.</p>
    <p style="margin:0"><strong>Multiplayer/Chat:</strong> Join a multiplayer session to see other players and use chat to coordinate.</p>
  `)

  const howToPlayCloseBtn = dom.createElement('button')
  howToPlayCloseBtn.textContent = 'Close'
  howToPlayCloseBtn.style.cssText = `${BUTTON_STYLE};min-width:0;width:100%;margin-top:8px`
  howToPlayCloseBtn.dataset['role'] = 'how-to-play-close'
  dom.appendChildTo(howToPlayPanel, howToPlayCloseBtn)
  dom.appendChildTo(panel, howToPlayPanel)

  const achievementsBtn = dom.createElement('button')
  achievementsBtn.textContent = 'Achievements'
  achievementsBtn.style.cssText = BUTTON_STYLE
  achievementsBtn.dataset['role'] = 'achievements'
  dom.appendChildTo(panel, achievementsBtn)

  // Content is (re)built each time the panel opens so unlock/statistics state
  // is always current — see PauseMenuService.handleAchievementsClick.
  const achievementsPanel = dom.createElement('div')
  achievementsPanel.style.cssText = [
    'display:none',
    'background:#9f9f9f',
    'border:2px solid #111',
    'box-shadow:inset 2px 2px #d8d8d8,inset -2px -2px #555',
    'padding:12px',
    'color:#202020',
    'font-size:13px',
    'line-height:1.45',
    'max-width:360px',
    'text-align:left',
  ].join(';')
  achievementsPanel.setAttribute('role', 'region')
  achievementsPanel.setAttribute('aria-label', 'Achievements')
  const achievementsContent = dom.createElement('div')
  dom.appendChildTo(achievementsPanel, achievementsContent)
  const achievementsCloseBtn = dom.createElement('button')
  achievementsCloseBtn.textContent = 'Close'
  achievementsCloseBtn.style.cssText = `${BUTTON_STYLE};min-width:0;width:100%;margin-top:8px`
  achievementsCloseBtn.dataset['role'] = 'achievements-close'
  dom.appendChildTo(achievementsPanel, achievementsCloseBtn)
  dom.appendChildTo(panel, achievementsPanel)

  const saveQuitBtn = dom.createElement('button')
  saveQuitBtn.textContent = 'Save & Quit to Title'
  saveQuitBtn.style.cssText = BUTTON_STYLE
  saveQuitBtn.dataset['role'] = 'save-quit'
  dom.appendChildTo(panel, saveQuitBtn)

  dom.appendChildTo(backdrop, panel)
  dom.appendChild(backdrop)

  return {
    backdropEl: Option.some(backdrop),
    panelEl: Option.some(panel),
    resumeBtn: Option.some(resumeBtn),
    settingsBtn: Option.some(settingsBtn),
    howToPlayBtn: Option.some(howToPlayBtn),
    howToPlayPanel: Option.some(howToPlayPanel),
    howToPlayCloseBtn: Option.some(howToPlayCloseBtn),
    achievementsBtn: Option.some(achievementsBtn),
    achievementsPanel: Option.some(achievementsPanel),
    achievementsContentEl: Option.some(achievementsContent),
    achievementsCloseBtn: Option.some(achievementsCloseBtn),
    saveQuitBtn: Option.some(saveQuitBtn),
  }
}
