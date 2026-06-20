import { Option } from 'effect'
import * as THREE from 'three'

import type { ColorPort } from '@ts-minecraft/core'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'

import type { SessionRuntimeParams } from '@ts-minecraft/app/main/session-runtime-types'

export const assembleFrameHandlerDeps = (params: SessionRuntimeParams): FrameHandlerDeps => {
  const {
    rendering: { renderer, scene, camera, composer, gtaoPass, bloomPass, bokehPass, godRaysPass, smaaPass, lighting },
    hud,
    state,
  } = params
  const { light, ambientLight, skyPort, moonPort, skyNight, skyDay, skyCurrent, sky } = lighting
  const dayNightRenderer: FrameHandlerDeps['lights']['renderer'] = {
    setClearColor: (color: ColorPort) =>
      renderer.setClearColor(new THREE.Color().setRGB(color.r, color.g, color.b)),
  }

  return {
    renderer,
    scene,
    camera,
    respawnPositionRef: state.respawnPositionRef,
    lights: { light, ambientLight, renderer: dayNightRenderer, skyNight, skyDay, skyCurrent, sky: Option.some(skyPort), moon: Option.some(moonPort) },
    skyMesh: Option.some(sky),
    fpsElement: Option.fromNullable(hud.fpsElement),
    healthValueElement: Option.fromNullable(hud.healthValueElement),
    healthMaxElement: Option.fromNullable(hud.healthMaxElement),
    hungerValueElement: Option.fromNullable(hud.hungerValueElement),
    hungerMaxElement: Option.fromNullable(hud.hungerMaxElement),
    xpLevelElement: Option.fromNullable(hud.xpLevelElement),
    xpBarElement: Option.fromNullable(hud.xpBarElement),
    xpBarMaxElement: Option.fromNullable(hud.xpBarMaxElement),
    armorValueElement: Option.fromNullable(hud.armorValueElement),
    airElement: Option.fromNullable(hud.airElement),
    breakProgressElement: Option.fromNullable(hud.breakProgressElement),
    gamePausedRef: state.gamePausedRef,
    sessionPausedRef: state.control.isPausedRef,
    composer: Option.some(composer),
    gtaoPass,
    bloomPass,
    dofPass: bokehPass,
    godRaysPass,
    smaaPass,
  }
}
