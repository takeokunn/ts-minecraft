import type { Effect, MutableRef, Ref, Option } from 'effect'
import * as THREE from 'three'
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import type { WebGLRenderTarget } from 'three'

import type { BiomeService } from '@ts-minecraft/world'
import type { RecipeService } from '@ts-minecraft/inventory/application/recipe-service'
import type { DebugOverlayService } from '@ts-minecraft/presentation'
import type { DeathScreenService } from '@ts-minecraft/presentation'
import type { Position, MoonPhasePort, SkyMaterialPort } from '@ts-minecraft/core'
import type { PlayerError } from '@ts-minecraft/entity/domain/errors'
import type { StorageError } from '@ts-minecraft/world'

import type { PendingResize } from './browser-runtime-types'
import type { SessionControl } from '@ts-minecraft/app/main/session-control'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'

export type SessionLightingSnapshot = {
  readonly light: THREE.DirectionalLight
  readonly ambientLight: THREE.AmbientLight
  readonly sky: THREE.Object3D
  readonly skyPort: SkyMaterialPort
  readonly moonPort: MoonPhasePort
  readonly skyNight: THREE.Color
  readonly skyDay: THREE.Color
  readonly skyCurrent: THREE.Color
}

export type SessionHudElements = {
  readonly fpsElement: HTMLElement | null
  readonly healthValueElement: HTMLElement | null
  readonly healthMaxElement: HTMLElement | null
  readonly hungerValueElement: HTMLElement | null
  readonly hungerMaxElement: HTMLElement | null
  readonly xpLevelElement: HTMLElement | null
  readonly xpBarElement: HTMLElement | null
  readonly xpBarMaxElement: HTMLElement | null
  readonly armorValueElement: HTMLElement | null
  readonly airElement: HTMLElement | null
  readonly breakProgressElement: HTMLElement | null
}

export type SessionRenderingResources = {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly composerRT: WebGLRenderTarget
  readonly composer: EffectComposer
  readonly gtaoPass: FrameHandlerDeps['gtaoPass']
  readonly bloomPass: FrameHandlerDeps['bloomPass']
  readonly bokehPass: FrameHandlerDeps['dofPass']
  readonly godRaysPass: FrameHandlerDeps['godRaysPass']
  readonly smaaPass: FrameHandlerDeps['smaaPass']
  readonly lighting: SessionLightingSnapshot
}

export type SessionRuntimeState = {
  readonly control: SessionControl
  readonly gamePausedRef: Ref.Ref<boolean>
  readonly respawnPositionRef: MutableRef.MutableRef<Position>
  readonly pendingResizeRef: MutableRef.MutableRef<Option.Option<PendingResize>>
  readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>
  readonly persistSessionState: () => Effect.Effect<void, PlayerError | StorageError>
}

export type SessionRuntimeOverlays = {
  readonly deathScreen: DeathScreenService
  readonly debugOverlay: DebugOverlayService
  readonly biomeService: BiomeService
  readonly recipeService: RecipeService
}

export type SessionRuntimeParams = {
  readonly rendering: SessionRenderingResources
  readonly hud: SessionHudElements
  readonly state: SessionRuntimeState
  readonly overlays: SessionRuntimeOverlays
}
