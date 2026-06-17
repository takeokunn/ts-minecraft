import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import type { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import type { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import type { GodRaysPass } from '@ts-minecraft/rendering'
import type { Settings } from '@ts-minecraft/game'

export type ResolvedDeps = {
  readonly skyMeshOrNull: import('three').Object3D | null
  readonly fpsElementOrNull: HTMLElement | null
  readonly healthValueElementOrNull: HTMLElement | null
  readonly healthMaxElementOrNull: HTMLElement | null
  readonly hungerValueElementOrNull: HTMLElement | null
  readonly hungerMaxElementOrNull: HTMLElement | null
  readonly airElementOrNull: HTMLElement | null
  readonly breakProgressElementOrNull: HTMLElement | null
  readonly xpLevelElementOrNull: HTMLElement | null
  readonly xpBarElementOrNull: HTMLElement | null
  readonly xpBarMaxElementOrNull: HTMLElement | null
  readonly armorValueElementOrNull: HTMLElement | null
  readonly gtaoPassOrNull: GTAOPass | null
  readonly bloomPassOrNull: UnrealBloomPass | null
  readonly dofPassOrNull: BokehPass | null
  readonly smaaPassOrNull: SMAAPass | null
  readonly godRaysPassOrNull: GodRaysPass | null
  readonly composerOrNull: EffectComposer | null
}

export type FrameSettingsView = Settings

export type FrameLoopHandlers = {
  readonly frameHandler: (deltaTime: import('@ts-minecraft/core').DeltaTimeSecs) => import('effect').Effect.Effect<void, never>
  readonly maintenanceHandler: () => import('effect').Effect.Effect<boolean, never>
}
