import { Effect } from 'effect'
import * as THREE from 'three'
import { StartupError } from '@ts-minecraft/game'

import { RendererService } from '@ts-minecraft/rendering'
import { PerfHudService } from '@ts-minecraft/rendering'
import { TerrainWorkerPool } from '@ts-minecraft/worker'
import { SettingsService } from '@ts-minecraft/game'
import { StorageService, NoiseService } from '@ts-minecraft/world'
import { SoundManager, MusicManager } from '@ts-minecraft/game'

// BootContext — persistent process-level resources that survive across world sessions.
// Created once by `bootProgram` at process startup and threaded into every
// `sessionProgram` invocation by `mainMenuLoop`.
// Lifetime: the entire browser tab; the boot scope is closed only when the page
// unloads (Effect's release path via Effect.scoped).
// Per FR-1.8 (Quit-to-Title with clean GPU teardown), these resources MUST NOT be
// torn down when a session ends — only session-scoped GPU resources (chunk meshes,
// refraction RT, water shader uniforms) are released.
export type BootContext = {
  readonly canvas: HTMLCanvasElement
  readonly renderer: THREE.WebGLRenderer
  readonly perfHud: PerfHudService
  readonly settingsService: SettingsService
  readonly storageService: StorageService
  readonly noiseService: NoiseService
  readonly terrainPool: TerrainWorkerPool
  readonly soundManager: SoundManager
  readonly musicManager: MusicManager
}

// Initializes the persistent process-level layer — runs ONCE at startup and returns
// a BootContext reused across every world session. Must be invoked under `Effect.scoped`
// so the renderer + audio engine are released on tab unload.
//
// Excluded from boot (lives in sessionProgram):
//   - scene + camera (per-world scene graph)
//   - composer + post-processing passes (depend on scene/camera bindings)
//   - chunk/entity/world services (per-world domain state)
//   - all overlays (mounted into session scope)
//   - game loop (forked per session)
//
// NOTE: composer/passes are kept in sessionProgram because RenderPass binds
// scene+camera by reference at construction; pulling them into boot would require
// rebinding `renderPass.scene = ...` on every session entry.
export const bootProgram = Effect.gen(function* () {
  const canvas = yield* Effect.sync(() => document.getElementById('game-canvas')).pipe(
    Effect.flatMap((el) => {
      if (el === null) return Effect.fail(new StartupError({ reason: 'Canvas element not found' }))
      return el instanceof HTMLCanvasElement
        ? Effect.succeed(el)
        : Effect.fail(new StartupError({ reason: 'Canvas element is not an HTMLCanvasElement' }))
    }),
  )

  const rendererService = yield* RendererService
  const perfHud = yield* PerfHudService
  const settingsService = yield* SettingsService
  const storageService = yield* StorageService
  const noiseService = yield* NoiseService
  const terrainPool = yield* TerrainWorkerPool
  const soundManager = yield* SoundManager
  const musicManager = yield* MusicManager

  // Renderer creation (long-lived GPU context).
  const renderer = yield* rendererService.create(canvas).pipe(
    Effect.mapError((cause) => new StartupError({ reason: 'Failed to create renderer', cause })),
  )

  // Shadow map: always initialized as enabled (cannot change after first render).
  // castShadow on lights is toggled per-frame based on settings.
  yield* Effect.sync(() => {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.shadowMap.autoUpdate = false
    renderer.shadowMap.needsUpdate = true
  })

  yield* Effect.log('Boot context ready (renderer + workers + audio + settings + storage)')

  return {
    canvas,
    renderer,
    perfHud,
    settingsService,
    storageService,
    noiseService,
    terrainPool,
    soundManager,
    musicManager,
  }
})
