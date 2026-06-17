import { Option } from 'effect'
import * as THREE from 'three'

import type { ColorPort } from '@ts-minecraft/core'
import type { FrameHandlerDeps } from '@ts-minecraft/app/frame/types'

import type { SessionRuntimeParams } from './session-runtime'

export type SessionHudElements = Pick<
  SessionRuntimeParams,
  | 'fpsElement'
  | 'healthValueElement'
  | 'healthMaxElement'
  | 'hungerValueElement'
  | 'hungerMaxElement'
  | 'xpLevelElement'
  | 'xpBarElement'
  | 'xpBarMaxElement'
  | 'armorValueElement'
  | 'airElement'
  | 'breakProgressElement'
>

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

export const assembleFrameHandlerDeps = (p: SessionRuntimeParams): FrameHandlerDeps => {
  const dayNightRenderer = {
    setClearColor: (color: ColorPort) =>
      p.renderer.setClearColor(new THREE.Color().setRGB(color.r, color.g, color.b)),
  }
  const { light, ambientLight, skyPort, moonPort, skyNight, skyDay, skyCurrent, sky } = p.lighting
  return {
    renderer: p.renderer,
    scene: p.scene,
    camera: p.camera,
    respawnPositionRef: p.respawnPositionRef,
    lights: { light, ambientLight, renderer: dayNightRenderer, skyNight, skyDay, skyCurrent, sky: Option.some(skyPort), moon: Option.some(moonPort) },
    skyMesh: Option.some(sky),
    fpsElement: Option.fromNullable(p.fpsElement),
    healthValueElement: Option.fromNullable(p.healthValueElement),
    healthMaxElement: Option.fromNullable(p.healthMaxElement),
    hungerValueElement: Option.fromNullable(p.hungerValueElement),
    hungerMaxElement: Option.fromNullable(p.hungerMaxElement),
    xpLevelElement: Option.fromNullable(p.xpLevelElement),
    xpBarElement: Option.fromNullable(p.xpBarElement),
    xpBarMaxElement: Option.fromNullable(p.xpBarMaxElement),
    armorValueElement: Option.fromNullable(p.armorValueElement),
    airElement: Option.fromNullable(p.airElement),
    breakProgressElement: Option.fromNullable(p.breakProgressElement),
    gamePausedRef: p.gamePausedRef,
    sessionPausedRef: p.control.isPausedRef,
    composer: Option.some(p.composer),
    gtaoPass: p.gtaoPass,
    bloomPass: p.bloomPass,
    dofPass: p.bokehPass,
    godRaysPass: p.godRaysPass,
    smaaPass: p.smaaPass,
  }
}
