import { Effect, MutableRef } from 'effect'
import * as THREE from 'three'
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import type { WebGLRenderTarget } from 'three'

import type { BiomeService } from '@ts-minecraft/world'
import type { RecipeService } from '@ts-minecraft/inventory'
import type { DebugOverlayService } from '@ts-minecraft/presentation'
import type { DeathScreenService } from '@ts-minecraft/presentation'
import type { Position } from '@ts-minecraft/core'

import type { BootContext } from '@ts-minecraft/app/main/boot'
import type { SessionControl } from '@ts-minecraft/app/main/session-control'
import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types'
import type { SessionRuntimeParams } from '@ts-minecraft/app/main/session-runtime'
import { buildSessionRuntimeServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services'
import { createSessionRuntimeBootstrapState } from '@ts-minecraft/app/main/session-bootstrap-runtime-state'

export type SessionRuntimeBundle = {
  readonly runtimeParams: SessionRuntimeParams
  readonly runtimeServices: ReturnType<typeof buildSessionRuntimeServices>
}

export type SessionRuntimeBundleInput = {
  readonly bootCtx: Pick<BootContext, 'perfHud' | 'renderer' | 'settingsService' | 'soundManager' | 'musicManager'>
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly composerRT: WebGLRenderTarget
  readonly composer: EffectComposer
  readonly gtaoPass: SessionRuntimeParams['gtaoPass']
  readonly bloomPass: SessionRuntimeParams['bloomPass']
  readonly bokehPass: SessionRuntimeParams['bokehPass']
  readonly godRaysPass: SessionRuntimeParams['godRaysPass']
  readonly smaaPass: SessionRuntimeParams['smaaPass']
  readonly lighting: SessionRuntimeParams['lighting']
  readonly control: SessionControl
  readonly respawnPositionRef: MutableRef.MutableRef<Position>
  readonly persistSessionState: SessionRuntimeParams['persistSessionState']
  readonly deathScreen: DeathScreenService
  readonly debugOverlay: DebugOverlayService
  readonly biomeService: BiomeService
  readonly recipeService: RecipeService
  readonly services: SessionBootstrapServices
}

export const buildSessionRuntimeBundle = ({
  bootCtx,
  scene,
  camera,
  composerRT,
  composer,
  gtaoPass,
  bloomPass,
  bokehPass,
  godRaysPass,
  smaaPass,
  lighting,
  control,
  respawnPositionRef,
  persistSessionState,
  deathScreen,
  debugOverlay,
  biomeService,
  recipeService,
  services,
}: SessionRuntimeBundleInput) =>
  Effect.gen(function* () {
    const { pendingResizeRef, pendingSaveDirtyChunksRef, gamePausedRef, hudElements } = yield* createSessionRuntimeBootstrapState
    const { fpsElement, healthValueElement, healthMaxElement, hungerValueElement, hungerMaxElement, xpLevelElement, xpBarElement, xpBarMaxElement, armorValueElement, airElement, breakProgressElement } = hudElements

    const runtimeParams: SessionRuntimeParams = {
      renderer: bootCtx.renderer,
      scene,
      camera,
      composerRT,
      composer,
      gtaoPass,
      bloomPass,
      bokehPass,
      godRaysPass,
      smaaPass,
      lighting,
      fpsElement,
      healthValueElement,
      healthMaxElement,
      hungerValueElement,
      hungerMaxElement,
      xpLevelElement,
      xpBarElement,
      xpBarMaxElement,
      armorValueElement,
      airElement,
      breakProgressElement,
      control,
      gamePausedRef,
      respawnPositionRef,
      pendingResizeRef,
      pendingSaveDirtyChunksRef,
      persistSessionState,
      deathScreen,
      debugOverlay,
      biomeService,
      recipeService,
    }

    const runtimeServices = buildSessionRuntimeServices({ bootCtx, services })

    return { runtimeParams, runtimeServices }
  })
