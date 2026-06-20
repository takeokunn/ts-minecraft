import type { SessionHudElements } from '@ts-minecraft/app/main/session-runtime-types'

const HUD_ELEMENT_IDS = {
  fpsElement: 'fps-value',
  healthValueElement: 'health-value',
  healthMaxElement: 'health-max',
  hungerValueElement: 'hunger-value',
  hungerMaxElement: 'hunger-max',
  xpLevelElement: 'xp-level',
  xpBarElement: 'xp-bar',
  xpBarMaxElement: 'xp-bar-max',
  armorValueElement: 'armor-value',
  airElement: 'air-display',
  breakProgressElement: 'break-progress',
} as const

export const readSessionHudElements = (): SessionHudElements => ({
  fpsElement: document.getElementById(HUD_ELEMENT_IDS.fpsElement),
  healthValueElement: document.getElementById(HUD_ELEMENT_IDS.healthValueElement),
  healthMaxElement: document.getElementById(HUD_ELEMENT_IDS.healthMaxElement),
  hungerValueElement: document.getElementById(HUD_ELEMENT_IDS.hungerValueElement),
  hungerMaxElement: document.getElementById(HUD_ELEMENT_IDS.hungerMaxElement),
  xpLevelElement: document.getElementById(HUD_ELEMENT_IDS.xpLevelElement),
  xpBarElement: document.getElementById(HUD_ELEMENT_IDS.xpBarElement),
  xpBarMaxElement: document.getElementById(HUD_ELEMENT_IDS.xpBarMaxElement),
  armorValueElement: document.getElementById(HUD_ELEMENT_IDS.armorValueElement),
  airElement: document.getElementById(HUD_ELEMENT_IDS.airElement),
  breakProgressElement: document.getElementById(HUD_ELEMENT_IDS.breakProgressElement),
})
