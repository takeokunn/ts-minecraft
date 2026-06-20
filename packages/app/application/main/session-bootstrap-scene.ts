import { Effect } from 'effect'
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import type { WebGLRenderTarget } from 'three'

import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import type { BootContext } from '@ts-minecraft/app/main/boot'
import { buildPostProcessing } from '@ts-minecraft/app/main/session-post-processing'
import { registerComposerDisposal } from '@ts-minecraft/app/main/session-disposal'

type InitialSettings = Awaited<ReturnType<BootContext['settingsService']['getSettings']>> extends Effect.Effect<infer A, never> ? A : never
type InitialGraphics = ReturnType<typeof import('@ts-minecraft/game/application/settings-service.config').resolvePreset>
type SessionPostProcessing = Awaited<ReturnType<typeof buildPostProcessing>> extends Effect.Effect<infer A, never> ? A : never

export type SessionBootstrapSceneBundle = {
  readonly scene: import('three').Scene
  readonly camera: import('three').PerspectiveCamera
  readonly composerRT: WebGLRenderTarget
  readonly composer: EffectComposer
  readonly gtaoPass: SessionPostProcessing['gtaoPass']
  readonly godRaysPass: SessionPostProcessing['godRaysPass']
  readonly bloomPass: SessionPostProcessing['bloomPass']
  readonly bokehPass: SessionPostProcessing['bokehPass']
  readonly smaaPass: SessionPostProcessing['smaaPass']
}

export type SessionBootstrapSceneInput = {
  readonly renderer: import('three').WebGLRenderer
  readonly canvas: HTMLCanvasElement
  readonly sceneService: import('@ts-minecraft/rendering').SceneService
  readonly cameraService: import('@ts-minecraft/rendering').PerspectiveCameraService
  readonly initialSettings: InitialSettings
  readonly initialGraphics: InitialGraphics
}

export const buildSessionBootstrapScene = ({
  renderer,
  canvas,
  sceneService,
  cameraService,
  initialSettings,
  initialGraphics,
}: SessionBootstrapSceneInput) =>
  Effect.gen(function* () {
    const scene = yield* sceneService.create()

    const camera = yield* cameraService.create({
      fov: 75,
      aspect: canvas.clientWidth / canvas.clientHeight,
      near: 0.1,
      far: Math.max(initialSettings.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300),
    })

    const { composerRT, composer, gtaoPass, godRaysPass, bloomPass, bokehPass, smaaPass, compositePass } = yield* buildPostProcessing(
      renderer,
      scene,
      camera,
      canvas,
      initialGraphics,
      { useCompositePass: initialGraphics.useCompositePass },
    )

    yield* registerComposerDisposal(composerRT, composer, [gtaoPass, bloomPass, bokehPass, godRaysPass, smaaPass, compositePass])

    return { scene, camera, composerRT, composer, gtaoPass, godRaysPass, bloomPass, bokehPass, smaaPass }
  })
