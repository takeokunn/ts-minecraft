import type { MutableRef, Option, Ref } from 'effect'
import type * as THREE from 'three'
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import type { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import type { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import type { GodRaysPass } from '@ts-minecraft/rendering'
import type { DayNightLights } from '@ts-minecraft/game'
import type { Position } from '@ts-minecraft/core'

// Three.js objects/DOM state owned by main.ts before the game loop starts — passed as values,
// not Effect services. gamePausedRef is a plain Ref rather than a dedicated service (single boolean).
export type FrameHandlerDeps = {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly respawnPositionRef: MutableRef.MutableRef<Position>
  readonly lights: DayNightLights
  readonly fpsElement: Option.Option<HTMLElement>
  readonly healthValueElement: Option.Option<HTMLElement>
  readonly healthMaxElement: Option.Option<HTMLElement>
  readonly hungerValueElement: Option.Option<HTMLElement>
  readonly hungerMaxElement: Option.Option<HTMLElement>
  readonly xpLevelElement: Option.Option<HTMLElement>
  readonly xpBarElement: Option.Option<HTMLElement>
  readonly xpBarMaxElement: Option.Option<HTMLElement>
  readonly armorValueElement: Option.Option<HTMLElement>
  readonly airElement: Option.Option<HTMLElement>
  readonly breakProgressElement: Option.Option<HTMLElement>
  readonly gamePausedRef: Ref.Ref<boolean>
  // FR-1.4: true while pause-menu is open. Distinct from gamePausedRef (transient overlay state).
  // Read synchronously by frame stages to skip simulation while keeping input + render alive.
  readonly sessionPausedRef: MutableRef.MutableRef<boolean>
  readonly composer: Option.Option<EffectComposer>
  readonly skyMesh: Option.Option<THREE.Object3D>
  readonly gtaoPass: Option.Option<GTAOPass>
  readonly bloomPass: Option.Option<UnrealBloomPass>
  readonly dofPass: Option.Option<BokehPass>
  readonly godRaysPass: Option.Option<GodRaysPass>
  readonly smaaPass: Option.Option<SMAAPass>
}
