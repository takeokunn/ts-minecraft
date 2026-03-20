/**
 * Frame handler factory — composition-root orchestrator for the game loop.
 *
 * This file intentionally imports from both application/ and presentation/ layers
 * because it is the per-frame coordinator: it sequences all subsystems (physics,
 * rendering, input, UI) in a single Effect.gen for each frame.
 *
 * Architectural note: this file lives at src/ root alongside main.ts and layers.ts.
 * Cross-layer imports here are the same kind of orchestration — acceptable in a composition root.
 */
import { Cause, Effect, Option, Ref } from 'effect'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { GodRaysPass } from '@/infrastructure/three/god-rays-pass'
import { GameStateService } from '@/application/game-state'
import { DEFAULT_PLAYER_ID } from '@/application/constants'
import { FirstPersonCameraService } from '@/application/camera/first-person-camera-service'
import { BlockService } from '@/application/block/block-service'
import { HotbarService } from '@/application/hotbar/hotbar-service'
import { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import { TimeService } from '@/application/time/time-service'
import { SettingsService } from '@/application/settings/settings-service'
import { FPSCounterService } from '@/presentation/fps-counter'
import { HotbarRendererService } from '@/presentation/hud/hotbar-three'
import { BlockHighlightService } from '@/presentation/highlight/block-highlight'
import { WorldRendererService } from '@/infrastructure/three/world-renderer'
import { InputService } from '@/presentation/input/input-service'
import { KeyMappings } from '@/application/input/key-mappings'
import { SettingsOverlayService } from '@/presentation/settings/settings-overlay'
import { InventoryRendererService } from '@/presentation/inventory/inventory-renderer'
import { HealthService } from '@/application/player/health-service'
import { type Chunk, CHUNK_SIZE, CHUNK_HEIGHT, blockIndex } from '@/domain/chunk'
import { updateDayNightCycle, type DayNightLights } from '@/application/time/day-night-cycle'
import type { DeltaTimeSecs } from '@/shared/kernel'

// Eye level offset for camera (player height - half body height)
const EYE_LEVEL_OFFSET = 0.7

// Module-level fallback to avoid per-frame object literal allocation in the error path
const FALLBACK_PLAYER_POS = Object.freeze({ x: 0, y: 64, z: 0 }) as { x: number; y: number; z: number }

/**
 * Three.js objects and DOM state that live outside the Effect layer graph.
 * These are mutable references passed by value at startup — not Effect services —
 * because they are created and owned by main.ts before the game loop starts.
 * `gamePausedRef` is a Ref rather than a dedicated service to avoid introducing
 * a `GamePauseService` for a single boolean that only frame-handler reads/writes.
 */
export interface FrameHandlerDeps {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly lights: DayNightLights
  readonly fpsElement: HTMLElement | null
  readonly healthValueElement: HTMLElement | null
  readonly healthMaxElement: HTMLElement | null
  readonly gamePausedRef: Ref.Ref<boolean>
  readonly composer?: EffectComposer
  readonly skyMesh?: THREE.Object3D | null
  readonly gtaoPass?: GTAOPass
  readonly bloomPass?: UnrealBloomPass
  readonly ssrPass?: SSRPass
  readonly dofPass?: BokehPass
  readonly godRaysPass?: GodRaysPass
  readonly smaaPass?: SMAAPass
}

/**
 * All Effect services needed per frame. Passed as explicit instances (not yielded from
 * context) so the returned handler has R = never — the frame Effect is self-contained
 * and does not require a per-frame `Effect.provide(MainLive)` that would rebuild all
 * 30+ layers at 60 Hz. Instances are resolved once in main.ts and forwarded here.
 */
export interface FrameHandlerServices {
  readonly gameState: GameStateService
  readonly firstPersonCamera: FirstPersonCameraService
  readonly blockHighlight: BlockHighlightService
  readonly inputService: InputService
  readonly blockService: BlockService
  readonly hotbarService: HotbarService
  readonly hotbarRenderer: HotbarRendererService
  readonly chunkManagerService: ChunkManagerService
  readonly timeService: TimeService
  readonly settingsService: SettingsService
  readonly settingsOverlay: SettingsOverlayService
  readonly inventoryRenderer: InventoryRendererService
  readonly fpsCounter: FPSCounterService
  readonly healthService: HealthService
  readonly worldRendererService: WorldRendererService
}

/**
 * Creates a curried frame handler: `createFrameHandler(deps, services)` returns
 * `(deltaTime) => Effect<void, never>` — a pure Effect requiring no context (R = never).
 *
 * The outer call binds Three.js objects (deps) and service instances (services) at startup.
 * The inner call is invoked once per animation frame by GameLoopService with the delta time.
 *
 * Services are passed explicitly rather than yielded from context to avoid the
 * `Effect.provide(MainLive)` anti-pattern, which would reconstruct the full layer graph
 * every frame at 60 Hz.
 */
export const createFrameHandler = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
): (deltaTime: DeltaTimeSecs) => Effect.Effect<void, never> => {
  // Accumulated total time for water shader uTime uniform (seconds since game start)
  let totalTimeSecs = 0

  // Pre-allocated for god rays sun position projection — reused each frame to avoid GC
  const _sunWorldPos = new THREE.Vector3()

  return (deltaTime: DeltaTimeSecs) =>
    Effect.gen(function* () {
      const {
        gameState,
        firstPersonCamera,
        blockHighlight,
        inputService,
        blockService,
        hotbarService,
        hotbarRenderer,
        chunkManagerService,
        timeService,
        settingsService,
        settingsOverlay,
        inventoryRenderer,
        fpsCounter,
        worldRendererService,
        healthService,
      } = services

      const { renderer, scene, camera, fpsElement, gamePausedRef } = deps

      // Accumulate total elapsed time for water shader uniform
      totalTimeSecs += deltaTime

      // Fetch settings once per frame for shadow/SSAO and day-length reactive changes
      const currentSettings = yield* settingsService.getSettings()

      // Derive effective lights: conditionally nullify sky port based on settings
      const effectiveLights = currentSettings.skyEnabled
        ? deps.lights
        : { ...deps.lights, sky: null }
      if (deps.skyMesh != null) deps.skyMesh.visible = currentSettings.skyEnabled

      // Hoist player position — shared across steps 1, 3.5, and 8 to avoid redundant Effect calls
      const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
        Effect.catchAllCause(() => Effect.succeed(FALLBACK_PLAYER_POS))
      )

      // 1. Chunk streaming (throttled internally to 200ms)
      yield* Effect.gen(function* () {
        yield* chunkManagerService.loadChunksAroundPlayer(playerPos)
        const loadedChunks = yield* chunkManagerService.getLoadedChunks()
        yield* worldRendererService.syncChunksToScene(loadedChunks, scene)
        yield* worldRendererService.applyFrustumCulling(camera)

        // Update groundY for position-based grounded detection.
        // Scan the player's column downward to find the topmost solid block,
        // then set groundY = blockY + 1 (visual top face) so the grounded
        // threshold in GameStateService correctly tracks uneven terrain.
        const cx = Math.floor(playerPos.x / CHUNK_SIZE)
        const cz = Math.floor(playerPos.z / CHUNK_SIZE)
        const lx = ((Math.floor(playerPos.x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        const lz = ((Math.floor(playerPos.z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        // Use O(1) Map cache lookup instead of O(n) linear scan over all loaded chunks
        const playerChunkOpt = yield* chunkManagerService.getChunk({ x: cx, z: cz }).pipe(
          Effect.map(Option.some<Chunk>),
          Effect.catchAllCause(() => Effect.succeed(Option.none<Chunk>()))
        )
        if (Option.isSome(playerChunkOpt)) {
          const playerChunk = playerChunkOpt.value
          const startY = Math.min(Math.floor(playerPos.y) + 1, CHUNK_HEIGHT - 1)
          let surfaceY = 0
          for (let y = startY; y >= 0; y--) {
            const idx = blockIndex(lx, y, lz)
            if (idx !== null && playerChunk.blocks[idx] !== 0) {
              surfaceY = y + 1
              break
            }
          }
          yield* gameState.updateGroundY(surfaceY)
        }
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Chunk streaming error: ${Cause.pretty(cause)}`)))

      // 2. Day/night cycle: advance time and update lighting + sky color
      yield* updateDayNightCycle(deltaTime, effectiveLights, timeService).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Day/night error: ${Cause.pretty(cause)}`))
      )

      // 3. Update game state (input -> movement -> physics -> position sync)
      yield* gameState.update(deltaTime).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Physics update error: ${Cause.pretty(cause)}`))
      )

      // 3.5. Health: fall damage processing and HUD update
      yield* Effect.gen(function* () {
        const isGrounded = yield* gameState.isPlayerGrounded()
        const fallDamage = yield* healthService.processFallDamage(playerPos.y, isGrounded)
        if (fallDamage > 0) {
          yield* healthService.applyDamage(fallDamage)
        }
        yield* healthService.tick()
        const health = yield* healthService.getHealth()
        // Pre-cached element refs (resolved once at startup in FrameHandlerDeps)
        if (deps.healthValueElement) deps.healthValueElement.textContent = String(health.current)
        if (deps.healthMaxElement) deps.healthMaxElement.textContent = String(health.max)
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Health error: ${Cause.pretty(cause)}`)))

      // 4. Update camera rotation from mouse look (suppressed when a modal is open)
      yield* Effect.gen(function* () {
        const paused = yield* Ref.get(gamePausedRef)
        if (!paused) yield* firstPersonCamera.update(camera, currentSettings.mouseSensitivity)
      })

      // 5. Update block highlight
      yield* blockHighlight.update(camera, scene)

      // 6. Handle overlay toggles: Escape (settings), E (inventory)
      yield* Effect.gen(function* () {
        const [escPressed, inventoryPressed] = yield* Effect.all([
          inputService.consumeKeyPress(KeyMappings.ESCAPE),
          inputService.consumeKeyPress(KeyMappings.INVENTORY_OPEN),
        ], { concurrency: 'unbounded' })

        if (escPressed) {
          const isInvOpen = yield* inventoryRenderer.isOpen()
          const isSettingsOpen = yield* settingsOverlay.isOpen()

          if (isInvOpen) {
            // Close inventory
            yield* inventoryRenderer.toggle()
            yield* Ref.set(gamePausedRef, false)
          } else if (isSettingsOpen) {
            // Close settings
            yield* settingsOverlay.toggle()
            yield* Ref.set(gamePausedRef, false)
          } else {
            // Open settings
            const nowOpen = yield* settingsOverlay.toggle()
            yield* Ref.set(gamePausedRef, nowOpen)
          }
        }

        if (inventoryPressed) {
          const isInvOpen = yield* inventoryRenderer.isOpen()
          if (isInvOpen) {
            // Close inventory
            yield* inventoryRenderer.toggle()
            yield* Ref.set(gamePausedRef, false)
          } else {
            // Close settings first if open, then open inventory
            const isSettingsOpen = yield* settingsOverlay.isOpen()
            if (isSettingsOpen) yield* settingsOverlay.toggle()
            yield* inventoryRenderer.toggle()
            yield* Ref.set(gamePausedRef, true)
          }
        }

        // Sync day length to TimeService in case user applied settings changes
        // Guard: only update if the value has actually changed (avoids 60 allocs/sec)
        const currentDayLength = yield* timeService.getDayLength()
        if (currentDayLength !== currentSettings.dayLengthSeconds) {
          yield* timeService.setDayLength(currentSettings.dayLengthSeconds)
        }

        // Refresh inventory display when open
        yield* inventoryRenderer.update()
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Overlay error: ${Cause.pretty(cause)}`)))

      // Guard prevents per-frame shadow map invalidation — Three.js marks shadow state dirty on every write
      if (deps.lights.light.castShadow !== currentSettings.shadowsEnabled) {
        deps.lights.light.castShadow = currentSettings.shadowsEnabled
      }

      // 7. Handle block interaction (break/place) and hotbar (suppressed when paused)
      yield* Effect.gen(function* () {
        const paused = yield* Ref.get(gamePausedRef)
        if (paused) return

        // Update hotbar slot selection (keyboard 1-9 and mouse wheel)
        yield* hotbarService.update()

        // Process block break/place clicks
        const leftClick = yield* inputService.consumeMouseClick(0)
        const rightClick = yield* inputService.consumeMouseClick(2)

        if (leftClick || rightClick) {
          const targetBlock = yield* blockHighlight.getTargetBlock()
          const targetHit = yield* blockHighlight.getTargetHit()

          if (leftClick && targetBlock !== null) {
            yield* blockService.breakBlock({ x: targetBlock.x, y: targetBlock.y, z: targetBlock.z })
            // Re-mesh the affected chunk
            const chunkCoord = {
              x: Math.floor(targetBlock.x / CHUNK_SIZE),
              z: Math.floor(targetBlock.z / CHUNK_SIZE),
            }
            const updatedChunk = yield* chunkManagerService.getChunk(chunkCoord)
            yield* worldRendererService.updateChunkInScene(updatedChunk, scene)
          }

          if (rightClick && targetHit !== null) {
            const adjacentPos = {
              x: targetHit.blockX + Math.round(targetHit.normal.x),
              y: targetHit.blockY + Math.round(targetHit.normal.y),
              z: targetHit.blockZ + Math.round(targetHit.normal.z),
            }
            const selectedBlock = yield* hotbarService.getSelectedBlockType()
            if (Option.isSome(selectedBlock)) {
              yield* blockService.placeBlock(adjacentPos, selectedBlock.value)
              // Re-mesh the affected chunk
              const chunkCoord = {
                x: Math.floor(adjacentPos.x / CHUNK_SIZE),
                z: Math.floor(adjacentPos.z / CHUNK_SIZE),
              }
              const updatedChunk = yield* chunkManagerService.getChunk(chunkCoord)
              yield* worldRendererService.updateChunkInScene(updatedChunk, scene)
            }
          }
        }

        // Update hotbar renderer with current slot state
        const slots = yield* hotbarService.getSlots()
        const selectedSlot = yield* hotbarService.getSelectedSlot()
        yield* hotbarRenderer.update(slots, selectedSlot)
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Block interaction error: ${Cause.pretty(cause)}`)))

      // 8. Sync camera position with player; keep shadow target centered on player
      // Uses hoisted playerPos from top of frame (avoids redundant getPlayerPosition call)
      camera.position.set(playerPos.x, playerPos.y + EYE_LEVEL_OFFSET, playerPos.z)
      // Shadow frustum follows player so terrain around them is always shadow-covered
      deps.lights.light.target.position.set(playerPos.x, 0, playerPos.z)
      deps.lights.light.target.updateMatrixWorld()

      // 9. Update FPS display — tick first to include this frame in the measurement,
      //    then read the updated average so the display reflects the current frame.
      yield* fpsCounter.tick(deltaTime)
      const fps = yield* fpsCounter.getFPS()
      if (fpsElement) fpsElement.textContent = fps.toFixed(1)

      // 9.5. Refraction pre-pass for water shader (render scene without water to capture underwater)
      yield* worldRendererService.doRefractionPrePass(deps.renderer, deps.scene, deps.camera).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Refraction pre-pass error: ${Cause.pretty(cause)}`))
      )

      // Update water uniforms (skip if canvas dimensions are zero — avoids shader divide-by-zero)
      const canvasW = deps.renderer.domElement.clientWidth
      const canvasH = deps.renderer.domElement.clientHeight
      if (canvasW > 0 && canvasH > 0) {
        yield* worldRendererService.updateWaterUniforms(
          totalTimeSecs,
          deps.camera.position,
          canvasW,
          canvasH,
        )
      }

      // 10. Sync pass enable states from settings, then render via EffectComposer
      if (deps.gtaoPass) deps.gtaoPass.enabled = currentSettings.ssaoEnabled && renderer.capabilities.isWebGL2
      if (deps.bloomPass) deps.bloomPass.enabled = currentSettings.bloomEnabled
      if (deps.dofPass) deps.dofPass.enabled = currentSettings.dofEnabled
      if (deps.smaaPass) deps.smaaPass.enabled = currentSettings.smaaEnabled

      if (deps.ssrPass) {
        if (currentSettings.ssrEnabled && renderer.capabilities.isWebGL2) {
          const waterMeshes = yield* worldRendererService.getWaterMeshes()
          deps.ssrPass.selects = waterMeshes as THREE.Mesh[]
          deps.ssrPass.enabled = true
        } else {
          deps.ssrPass.enabled = false
        }
      }

      if (deps.godRaysPass) {
        if (currentSettings.godRaysEnabled) {
          const lightPos = (deps.lights.light as unknown as THREE.DirectionalLight).position
          _sunWorldPos.copy(lightPos).normalize().multiplyScalar(100)
          _sunWorldPos.project(camera)
          // Convert NDC [-1,1] to screen UV [0,1]
          deps.godRaysPass.sunScreenPos.set(
            (_sunWorldPos.x + 1) * 0.5,
            (_sunWorldPos.y + 1) * 0.5,
          )
          deps.godRaysPass.enabled = true
        } else {
          deps.godRaysPass.enabled = false
        }
      }

      // Render via EffectComposer (disabled passes are skipped automatically)
      if (deps.composer) {
        deps.composer.render()
      } else {
        renderer.render(scene, camera)
      }

      // 11. Render HUD hotbar overlay (second pass; autoClear=false prevents erasing the main scene)
      renderer.autoClear = false
      yield* hotbarRenderer.render(renderer).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`HUD render error: ${Cause.pretty(cause)}`))
      )
      renderer.autoClear = true
    })
}
