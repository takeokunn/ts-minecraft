import { Effect } from 'effect'
import { beforeEach, describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'

import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { buildSessionBootstrapScene } from '@ts-minecraft/app/main/session-bootstrap-scene'
import { buildPostProcessing } from '@ts-minecraft/app/main/session-post-processing'
import { registerComposerDisposal } from '@ts-minecraft/app/main/session-disposal'

vi.mock('@ts-minecraft/app/main/session-post-processing', () => ({
  buildPostProcessing: vi.fn(),
}))

vi.mock('@ts-minecraft/app/main/session-disposal', () => ({
  registerComposerDisposal: vi.fn(),
}))

describe('buildSessionBootstrapScene', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('assembles the scene bundle and registers post-processing disposal', async () => {
    const scene = { id: 'scene' } as never
    const camera = { id: 'camera' } as never
    const composerRT = { dispose: vi.fn() } as never
    const composer = { dispose: vi.fn() } as never
    const gtaoPass = { dispose: vi.fn() } as never
    const godRaysPass = { dispose: vi.fn() } as never
    const bloomPass = { dispose: vi.fn() } as never
    const bokehPass = { dispose: vi.fn() } as never
    const smaaPass = { dispose: vi.fn() } as never
    const compositePass = { dispose: vi.fn() } as never

    const createScene = vi.fn(() => Effect.succeed(scene))
    const createCamera = vi.fn(() => Effect.succeed(camera))

    const sceneService = { create: createScene } as never
    const cameraService = { create: createCamera } as never
    const renderer = {} as never
    const canvas = { clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement
    const initialSettings = { renderDistance: 12 } as never
    const initialGraphics = { useCompositePass: true } as never

    vi.mocked(buildPostProcessing).mockReturnValue(Effect.succeed({
      composerRT,
      composer,
      gtaoPass,
      godRaysPass,
      bloomPass,
      bokehPass,
      smaaPass,
      compositePass,
    }) as never)
    vi.mocked(registerComposerDisposal).mockReturnValue(Effect.succeed(undefined) as never)

    const result = await Effect.runPromise(buildSessionBootstrapScene({
      renderer,
      canvas,
      sceneService,
      cameraService,
      initialSettings,
      initialGraphics,
    }))

    expect(createScene).toHaveBeenCalledOnce()
    expect(createCamera).toHaveBeenCalledWith(expect.objectContaining({
      fov: 75,
      aspect: 800 / 600,
      near: 0.1,
      far: Math.max(initialSettings.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300),
    }))
    expect(buildPostProcessing).toHaveBeenCalledWith(renderer, scene, camera, canvas, initialGraphics, { useCompositePass: true })
    expect(registerComposerDisposal).toHaveBeenCalledWith(composerRT, composer, [gtaoPass, bloomPass, bokehPass, godRaysPass, smaaPass, compositePass])
    expect(result).toEqual({
      scene,
      camera,
      composerRT,
      composer,
      gtaoPass,
      godRaysPass,
      bloomPass,
      bokehPass,
      smaaPass,
    })
  })
})
