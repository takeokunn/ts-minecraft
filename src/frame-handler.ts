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
import { CrosshairService } from '@/presentation/hud/crosshair'
import { BlockHighlightService } from '@/presentation/highlight/block-highlight'
import { WorldRendererService } from '@/infrastructure/three/world-renderer'
import { InputService } from '@/presentation/input/input-service'
import { KeyMappings } from '@/application/input/key-mappings'
import { SettingsOverlayService } from '@/presentation/settings/settings-overlay'
import { InventoryRendererService } from '@/presentation/inventory/inventory-renderer'
import { HealthService } from '@/application/player/health-service'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockIndex } from '@/domain/chunk'
import { updateDayNightCycle, type DayNightLights } from '@/application/time/day-night-cycle'
import type { DeltaTimeSecs } from '@/shared/kernel'

// Eye level offset for camera (player height - half body height)
const EYE_LEVEL_OFFSET = 0.7

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
  readonly healthElement: HTMLElement | null
  readonly gamePausedRef: Ref.Ref<boolean>
  readonly composer?: EffectComposer
}

/**
 * All Effect services needed per frame. Passed as explicit instances (not yielded from
 * context) so the returned handler has R = never — the frame Effect is self-contained
 * and does not require a per-frame `Effect.provide(MainLive)` that would rebuild all
 * 30+ layers at 60 Hz. Instances are resolved once in main.ts and forwarded here.
 */
export interface FrameHandlerServices {
  readonly gameState: InstanceType<typeof GameStateService>
  readonly firstPersonCamera: InstanceType<typeof FirstPersonCameraService>
  readonly crosshair: InstanceType<typeof CrosshairService>
  readonly blockHighlight: InstanceType<typeof BlockHighlightService>
  readonly inputService: InstanceType<typeof InputService>
  readonly blockService: InstanceType<typeof BlockService>
  readonly hotbarService: InstanceType<typeof HotbarService>
  readonly hotbarRenderer: InstanceType<typeof HotbarRendererService>
  readonly chunkManagerService: InstanceType<typeof ChunkManagerService>
  readonly timeService: InstanceType<typeof TimeService>
  readonly settingsService: InstanceType<typeof SettingsService>
  readonly settingsOverlay: InstanceType<typeof SettingsOverlayService>
  readonly inventoryRenderer: InstanceType<typeof InventoryRendererService>
  readonly fpsCounter: InstanceType<typeof FPSCounterService>
  readonly healthService: InstanceType<typeof HealthService>
  readonly worldRendererService: InstanceType<typeof WorldRendererService>
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
): (deltaTime: DeltaTimeSecs) => Effect.Effect<void, never> =>
  (deltaTime: DeltaTimeSecs) =>
    Effect.gen(function* () {
      const {
        gameState,
        firstPersonCamera,
        crosshair,
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

      // Suppress unused variable warning — crosshair is used for its side-effect
      void crosshair

      const { renderer, scene, camera, lights, fpsElement, gamePausedRef } = deps

      // Fetch settings once per frame for shadow/SSAO and day-length reactive changes
      const currentSettings = yield* settingsService.getSettings()

      // 1. Chunk streaming (throttled internally to 200ms)
      yield* Effect.gen(function* () {
        const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
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
        const playerChunk = loadedChunks.find((c) => c.coord.x === cx && c.coord.z === cz)
        if (playerChunk) {
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
      yield* updateDayNightCycle(deltaTime, lights, timeService).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Day/night error: ${Cause.pretty(cause)}`))
      )

      // 3. Update game state (input -> movement -> physics -> position sync)
      yield* gameState.update(deltaTime).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Physics update error: ${Cause.pretty(cause)}`))
      )

      // 3.5. Health: fall damage processing and HUD update
      yield* Effect.gen(function* () {
        const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
        const isGrounded = yield* gameState.isPlayerGrounded()
        const fallDamage = yield* healthService.processFallDamage(playerPos.y, isGrounded)
        if (fallDamage > 0) {
          yield* healthService.applyDamage(fallDamage)
        }
        yield* healthService.tick()
        const health = yield* healthService.getHealth()
        if (deps.healthElement) {
          const valueEl = deps.healthElement.querySelector('#health-value')
          const maxEl = deps.healthElement.querySelector('#health-max')
          if (valueEl) valueEl.textContent = String(health.current)
          if (maxEl) maxEl.textContent = String(health.max)
        }
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
        const escPressed = yield* inputService.consumeKeyPress(KeyMappings.ESCAPE)
        const inventoryPressed = yield* inputService.consumeKeyPress(KeyMappings.INVENTORY_OPEN)

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
        yield* timeService.setDayLength(currentSettings.dayLengthSeconds)

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
      yield* Effect.gen(function* () {
        const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
        camera.position.set(playerPos.x, playerPos.y + EYE_LEVEL_OFFSET, playerPos.z)
        // Shadow frustum follows player so terrain around them is always shadow-covered
        deps.lights.light.target.position.set(playerPos.x, 0, playerPos.z)
        deps.lights.light.target.updateMatrixWorld()
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Camera sync error: ${Cause.pretty(cause)}`)))

      // 9. Update FPS display
      yield* Effect.gen(function* () {
        const fps = yield* fpsCounter.getFPS()
        if (fpsElement) fpsElement.textContent = fps.toFixed(1)
        yield* fpsCounter.tick(deltaTime)
      })

      // 10. Render world (EffectComposer with SSAO when enabled, direct render otherwise)
      if (currentSettings.ssaoEnabled && renderer.capabilities.isWebGL2 && deps.composer) {
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
