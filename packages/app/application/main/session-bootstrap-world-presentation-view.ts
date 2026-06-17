import { Effect } from 'effect'
import type * as THREE from 'three'

import { CrosshairService } from '@ts-minecraft/presentation'
import { BlockHighlightService } from '@ts-minecraft/presentation'
import { HotbarRendererService } from '@ts-minecraft/presentation'
import { ParticleSystemService } from '@ts-minecraft/rendering'

export type SessionBootstrapWorldPresentationViewDeps = {
  readonly scene: THREE.Scene
  readonly canvas: HTMLCanvasElement
  readonly blockHighlight: BlockHighlightService
  readonly hotbarRenderer: HotbarRendererService
  readonly particleSystem: ParticleSystemService
  readonly crosshair: CrosshairService
}

export const initializeSessionBootstrapWorldPresentationView = ({
  scene,
  canvas,
  blockHighlight,
  hotbarRenderer,
  particleSystem,
  crosshair,
}: SessionBootstrapWorldPresentationViewDeps) =>
  Effect.gen(function* () {
    yield* blockHighlight.initialize(scene)
    yield* hotbarRenderer.initialize(canvas.clientWidth, canvas.clientHeight)
    yield* particleSystem.attach(scene)
    yield* crosshair.show()
  })
