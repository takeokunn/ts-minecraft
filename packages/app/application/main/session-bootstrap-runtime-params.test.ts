import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'

import { buildSessionRuntimeParams } from '@ts-minecraft/app/main/session-bootstrap-runtime-params'

describe('session-bootstrap-runtime-params', () => {
  it('builds the runtime params from the bootstrap state without reshaping values', () => {
    const renderer = { tag: 'renderer' } as never
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    const composerRT = { tag: 'composer-rt' } as never
    const composer = { tag: 'composer' } as never
    const control = { tag: 'control' } as never
    const respawnPositionRef = { tag: 'respawn' } as never
    const pendingResizeRef = MutableRef.make(Option.some({ kind: 'resize' } as never))
    const pendingSaveDirtyChunksRef = MutableRef.make(true)
    const gamePausedRef = Ref.make(true)
    const persistSessionState = vi.fn(() => Effect.void)
    const lighting = { tag: 'lighting' } as never
    const biomeService = { tag: 'biome' } as never
    const recipeService = { tag: 'recipe' } as never
    const rendering = {
      scene,
      camera,
      composerRT,
      composer,
      gtaoPass: { tag: 'gtao' } as never,
      bloomPass: { tag: 'bloom' } as never,
      bokehPass: { tag: 'bokeh' } as never,
      godRaysPass: { tag: 'god-rays' } as never,
      smaaPass: { tag: 'smaa' } as never,
      lighting,
    }
    const state = {
      control,
      respawnPositionRef,
      persistSessionState,
    }
    const overlays = {
      deathScreen: { tag: 'death-screen' } as never,
      debugOverlay: { tag: 'debug-overlay' } as never,
      biomeService,
      recipeService,
    }
    const runtimeState = {
      pendingResizeRef,
      pendingSaveDirtyChunksRef,
      gamePausedRef,
      hudElements: {
        fpsElement: { tag: 'fps' } as never,
        healthValueElement: { tag: 'health-value' } as never,
        healthMaxElement: { tag: 'health-max' } as never,
        hungerValueElement: { tag: 'hunger-value' } as never,
        hungerMaxElement: { tag: 'hunger-max' } as never,
        xpLevelElement: { tag: 'xp-level' } as never,
        xpBarElement: { tag: 'xp-bar' } as never,
        xpBarMaxElement: { tag: 'xp-bar-max' } as never,
        armorValueElement: { tag: 'armor-value' } as never,
        airElement: { tag: 'air' } as never,
        breakProgressElement: { tag: 'break-progress' } as never,
      },
    }

    const runtimeParams = buildSessionRuntimeParams({
      bootCtx: { renderer },
      rendering,
      state,
      overlays,
      runtimeState,
    })

    expect(runtimeParams.rendering.renderer).toBe(renderer)
    expect(runtimeParams.rendering.scene).toBe(scene)
    expect(runtimeParams.rendering.camera).toBe(camera)
    expect(runtimeParams.rendering.composerRT).toBe(composerRT)
    expect(runtimeParams.rendering.composer).toBe(composer)
    expect(runtimeParams.rendering.lighting).toBe(lighting)
    expect(runtimeParams.state.control).toBe(control)
    expect(runtimeParams.state.respawnPositionRef).toBe(respawnPositionRef)
    expect(runtimeParams.state.pendingResizeRef).toBe(pendingResizeRef)
    expect(runtimeParams.state.pendingSaveDirtyChunksRef).toBe(pendingSaveDirtyChunksRef)
    expect(runtimeParams.state.gamePausedRef).toBe(gamePausedRef)
    expect(runtimeParams.state.persistSessionState).toBe(persistSessionState)
    expect(runtimeParams.hud.fpsElement).toBe(runtimeState.hudElements.fpsElement)
    expect(runtimeParams.hud.breakProgressElement).toBe(runtimeState.hudElements.breakProgressElement)
    expect(runtimeParams.overlays.biomeService).toBe(biomeService)
    expect(runtimeParams.overlays.recipeService).toBe(recipeService)
  })
})
