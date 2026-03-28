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
import { Array as Arr, Cause, Effect, Option, Ref } from 'effect'
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
import { PlayerCameraStateService } from '@/application/camera/camera-state'
import { FirstPersonCameraService } from '@/application/camera/first-person-camera-service'
import { ThirdPersonCameraService } from '@/application/camera/third-person-camera-service'
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
import { MusicManager, SoundManager } from '@/audio'
import { EntityManager } from '@/entity/entityManager'
import { MobSpawner } from '@/entity/spawner'
import { VillageService } from '@/village/village-service'
import { TradingPresentationService } from '@/presentation/trading'
import { RedstoneComponentType } from '@/redstone/redstone-model'
import { RedstoneService } from '@/redstone/redstone-service'
import { FluidService } from '@/application/fluid/fluid-service'
import { type Chunk, CHUNK_SIZE, CHUNK_HEIGHT, blockIndex } from '@/domain/chunk'
import { updateDayNightCycle, type DayNightLights } from '@/application/time/day-night-cycle'
import type { DeltaTimeSecs } from '@/shared/kernel'

// Eye level offset for camera (player height - half body height)
const EYE_LEVEL_OFFSET = 0.7
const TRADE_DISTANCE = 4
const TRADE_OPEN_KEY = 'KeyT'
const TRADE_NEXT_KEY = 'ArrowDown'
const TRADE_PREV_KEY = 'ArrowUp'
const TRADE_EXECUTE_KEY = 'Enter'
const REDSTONE_TICK_INTERVAL_SECS = 0.05
const FLUID_TICK_INTERVAL_SECS = 0.05
const REDSTONE_PLACE_WIRE_KEY = 'KeyR'
const REDSTONE_PLACE_LEVER_KEY = 'KeyL'
const REDSTONE_PLACE_BUTTON_KEY = 'KeyB'
const REDSTONE_PLACE_TORCH_KEY = 'KeyO'
const REDSTONE_PLACE_PISTON_KEY = 'KeyP'
const REDSTONE_TOGGLE_LEVER_KEY = 'KeyY'
const REDSTONE_PRESS_BUTTON_KEY = 'KeyU'
const REDSTONE_TOGGLE_TORCH_KEY = 'KeyI'

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
  readonly fpsElement: Option.Option<HTMLElement>
  readonly healthValueElement: Option.Option<HTMLElement>
  readonly healthMaxElement: Option.Option<HTMLElement>
  readonly gamePausedRef: Ref.Ref<boolean>
  readonly composer?: EffectComposer
  readonly skyMesh: Option.Option<THREE.Object3D>
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
  readonly playerCameraState: PlayerCameraStateService
  readonly firstPersonCamera: FirstPersonCameraService
  readonly thirdPersonCamera: ThirdPersonCameraService
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
  readonly soundManager: SoundManager
  readonly musicManager: MusicManager
  readonly entityManager: EntityManager
  readonly mobSpawner: MobSpawner
  readonly villageService: VillageService
  readonly tradingPresentation: TradingPresentationService
  readonly redstoneService: RedstoneService
  readonly fluidService: FluidService
}

/**
 * Creates a curried frame handler: `yield* createFrameHandler(deps, services)` returns
 * `(deltaTime) => Effect<void, never>` — a pure Effect requiring no context (R = never).
 *
 * The outer call is an Effect that initialises per-handler Refs (totalTimeSecs) and
 * binds Three.js objects (deps) and service instances (services) at startup.
 * The inner call is invoked once per animation frame by GameLoopService with the delta time.
 *
 * Services are passed explicitly rather than yielded from context to avoid the
 * `Effect.provide(MainLive)` anti-pattern, which would reconstruct the full layer graph
 * every frame at 60 Hz.
 *
 * totalTimeSecs is a Ref rather than a closure `let` — aligns mutable per-handler state
 * with the Effect-TS Ref pattern and makes state management explicit and composable.
 */
export const createFrameHandler = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
): Effect.Effect<(deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>> =>
  Effect.gen(function* () {
    // Accumulated total time for water shader uTime uniform (seconds since game start)
    const totalTimeSecsRef = yield* Ref.make(0)
    const redstoneTickAccumulatorRef = yield* Ref.make(0)
    const fluidTickAccumulatorRef = yield* Ref.make(0)
    const lastLoadedChunksRef = yield* Ref.make<Option.Option<ReadonlyArray<Chunk>>>(Option.none())

    // Pre-allocated for god rays sun position projection — reused each frame to avoid GC
    const sunWorldPos = yield* Effect.sync(() => new THREE.Vector3())

    return (deltaTime: DeltaTimeSecs) =>
      Effect.gen(function* () {
      const {
        gameState,
        playerCameraState,
        firstPersonCamera,
        thirdPersonCamera,
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
        soundManager,
        musicManager,
        entityManager,
        mobSpawner,
        villageService,
        tradingPresentation,
        redstoneService,
        fluidService,
      } = services

      const { renderer, scene, camera, fpsElement, gamePausedRef } = deps

      // Accumulate total elapsed time for water shader uniform
      yield* Ref.update(totalTimeSecsRef, (t) => t + deltaTime)
      const totalTimeSecs = yield* Ref.get(totalTimeSecsRef)

      // Fetch settings once per frame for shadow/SSAO and day-length reactive changes
      const currentSettings = yield* settingsService.getSettings()

      // Derive effective lights: conditionally nullify sky port based on settings
      const effectiveLights = currentSettings.skyEnabled
        ? deps.lights
        : { ...deps.lights, sky: Option.none() }
      yield* Effect.sync(() => { Option.map(deps.skyMesh, (m) => { m.visible = currentSettings.skyEnabled }) })

      // Hoist player position — shared across steps 1, 3.5, and 8 to avoid redundant Effect calls
      const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
        Effect.catchAllCause(() => Effect.succeed(FALLBACK_PLAYER_POS))
      )

      // Audio settings + listener updates (defaults applied when optional settings are absent)
      yield* soundManager.applySettings({
        enabled: currentSettings.audioEnabled,
        masterVolume: currentSettings.masterVolume,
        sfxVolume: currentSettings.sfxVolume,
      })
      yield* musicManager.applySettings({
        enabled: currentSettings.audioEnabled,
        masterVolume: currentSettings.masterVolume,
        musicVolume: currentSettings.musicVolume,
      })
      yield* soundManager.setListenerPosition(playerPos)

      // 1. Chunk streaming (throttled internally to 200ms)
      yield* Effect.gen(function* () {
        yield* chunkManagerService.loadChunksAroundPlayer(playerPos)
        const loadedChunks = yield* chunkManagerService.getLoadedChunks()
        const lastLoadedChunks = yield* Ref.get(lastLoadedChunksRef)
        const chunksChanged = Option.match(lastLoadedChunks, {
          onNone: () => true,
          onSome: (previousLoadedChunks) => previousLoadedChunks !== loadedChunks,
        })

        if (chunksChanged) {
          yield* worldRendererService.syncChunksToScene(loadedChunks, scene)
          yield* fluidService.syncLoadedChunks(loadedChunks)
          yield* Ref.set(lastLoadedChunksRef, Option.some(loadedChunks))
        }

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
        yield* Option.match(playerChunkOpt, {
          onNone: () => Effect.void,
          onSome: (playerChunk) => Effect.gen(function* () {
            const startY = Math.min(Math.floor(playerPos.y) + 1, CHUNK_HEIGHT - 1)
            const surfaceY = Option.getOrElse(
              Arr.findFirst(
                Arr.makeBy(startY + 1, (i) => startY - i),
                (y) => {
                  return Option.match(blockIndex(lx, y, lz), {
                    onNone: () => false,
                    onSome: (idx) => playerChunk.blocks[idx] !== 0,
                  })
                }
              ).pipe(Option.map((y) => y + 1)),
              () => 0
            )
            yield* gameState.updateGroundY(surfaceY)
          }),
        })
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Chunk streaming error: ${Cause.pretty(cause)}`)))

      // 2. Day/night cycle: advance time and update lighting + sky color
      yield* updateDayNightCycle(deltaTime, effectiveLights, timeService).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Day/night error: ${Cause.pretty(cause)}`))
      )

      yield* Effect.gen(function* () {
        const isNight = yield* timeService.isNight()
        yield* musicManager.updateFromContext({
          isNight,
          playerPosition: playerPos,
        })
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Music update error: ${Cause.pretty(cause)}`)))

      // 2.5. Entity system: spawn and update AI state machine
      yield* Effect.gen(function* () {
        yield* mobSpawner.trySpawn(playerPos)
        yield* entityManager.update(deltaTime, playerPos)
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Entity system error: ${Cause.pretty(cause)}`)))

      // 2.75. Village simulation update (deterministic generation + villager AI)
      yield* Effect.gen(function* () {
        const timeOfDay = yield* timeService.getTimeOfDay()
        yield* villageService.update(playerPos, timeOfDay, deltaTime)
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Village system error: ${Cause.pretty(cause)}`)))

      // 2.9. Redstone simulation tick (fixed-step propagation)
      yield* Effect.gen(function* () {
        const ticksToRun = yield* Ref.modify(redstoneTickAccumulatorRef, (accumulated) => {
          const newAccumulated = accumulated + deltaTime
          const ticks = Math.floor(newAccumulated / REDSTONE_TICK_INTERVAL_SECS)
          const remainder = newAccumulated - ticks * REDSTONE_TICK_INTERVAL_SECS
          return [ticks, remainder]
        })
        if (ticksToRun <= 0) {
          return
        }
        yield* Effect.forEach(Arr.makeBy(ticksToRun, () => undefined), () => redstoneService.tick(), {
          concurrency: 'unbounded',
          discard: true,
        })
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Redstone system error: ${Cause.pretty(cause)}`)))

      // 2.95. Fluid simulation tick (fixed-step propagation)
      yield* Effect.gen(function* () {
        const ticksToRun = yield* Ref.modify(fluidTickAccumulatorRef, (accumulated) => {
          const newAccumulated = accumulated + deltaTime
          const ticks = Math.floor(newAccumulated / FLUID_TICK_INTERVAL_SECS)
          const remainder = newAccumulated - ticks * FLUID_TICK_INTERVAL_SECS
          return [ticks, remainder]
        })
        if (ticksToRun <= 0) {
          return
        }
        yield* Effect.forEach(Arr.makeBy(ticksToRun, () => undefined), () => fluidService.tick(), {
          concurrency: 'unbounded',
          discard: true,
        })
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Fluid system error: ${Cause.pretty(cause)}`)))

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
          yield* soundManager.playEffect('playerHurt', { position: playerPos })
        }
        yield* healthService.tick()
        const health = yield* healthService.getHealth()
        // Pre-cached element refs (resolved once at startup in FrameHandlerDeps)
        yield* Effect.sync(() => {
          Option.map(deps.healthValueElement, (el) => { el.textContent = String(health.current) })
          Option.map(deps.healthMaxElement, (el) => { el.textContent = String(health.max) })
        })
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Health error: ${Cause.pretty(cause)}`)))

      // 4. Update camera rotation from mouse look (suppressed when a modal is open)
      yield* Effect.gen(function* () {
        const paused = yield* Ref.get(gamePausedRef)
        if (!paused) yield* firstPersonCamera.update(camera, currentSettings.mouseSensitivity)
      })

      // 4.5. Handle view toggle: F5 switches first/third person before raycasting
      yield* Effect.gen(function* () {
        const cameraTogglePressed = yield* inputService.consumeKeyPress(KeyMappings.CAMERA_TOGGLE)
        if (cameraTogglePressed) {
          yield* playerCameraState.toggleMode()
        }
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Camera toggle error: ${Cause.pretty(cause)}`)))

      // 4.6. Camera perspective + position sync (use current mode before raycasting)
      yield* Effect.gen(function* () {
        const [rotation, cameraMode] = yield* Effect.all(
          [playerCameraState.getRotation(), playerCameraState.getMode()],
          { concurrency: 'unbounded' }
        )

        if (cameraMode === 'thirdPerson') {
          yield* thirdPersonCamera.update(camera, playerPos, EYE_LEVEL_OFFSET)
        } else {
          yield* Effect.sync(() => {
            const eyeY = playerPos.y + EYE_LEVEL_OFFSET
            camera.position.set(playerPos.x, eyeY, playerPos.z)
            camera.rotation.set(rotation.pitch, rotation.yaw, 0, 'YXZ')
          })
        }

        // Shadow frustum follows player so terrain around them is always shadow-covered
        yield* Effect.sync(() => {
          deps.lights.light.target.position.set(playerPos.x, 0, playerPos.z)
          deps.lights.light.target.updateMatrixWorld()
        })
      })

      // 5. Update block highlight
      yield* blockHighlight.update(camera, scene)

      // 6. Handle overlay toggles: Escape (settings), E (inventory)
      yield* Effect.gen(function* () {
        const [escPressed, inventoryPressed, tradePressed, tradeNextPressed, tradePrevPressed, tradeExecutePressed] = yield* Effect.all([
          inputService.consumeKeyPress(KeyMappings.ESCAPE),
          inputService.consumeKeyPress(KeyMappings.INVENTORY_OPEN),
          inputService.consumeKeyPress(TRADE_OPEN_KEY),
          inputService.consumeKeyPress(TRADE_NEXT_KEY),
          inputService.consumeKeyPress(TRADE_PREV_KEY),
          inputService.consumeKeyPress(TRADE_EXECUTE_KEY),
        ], { concurrency: 'unbounded' })

        const isTradeOpen = yield* tradingPresentation.isOpen()

        if (escPressed) {
          const isInvOpen = yield* inventoryRenderer.isOpen()
          const isSettingsOpen = yield* settingsOverlay.isOpen()

          if (isTradeOpen) {
            yield* tradingPresentation.close()
            yield* Ref.set(gamePausedRef, false)
          } else if (isInvOpen) {
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
            const tradeOpen = yield* tradingPresentation.isOpen()
            if (isSettingsOpen) yield* settingsOverlay.toggle()
            if (tradeOpen) yield* tradingPresentation.close()
            yield* inventoryRenderer.toggle()
            yield* Ref.set(gamePausedRef, true)
          }
        }

        if (tradePressed) {
          const tradeOpen = yield* tradingPresentation.isOpen()
          if (tradeOpen) {
            yield* tradingPresentation.close()
            yield* Ref.set(gamePausedRef, false)
          } else {
            const isInvOpen = yield* inventoryRenderer.isOpen()
            const isSettingsOpen = yield* settingsOverlay.isOpen()
            if (!isInvOpen && !isSettingsOpen) {
              const villagerOption = yield* villageService.findNearestVillager(playerPos, TRADE_DISTANCE)
              yield* Option.match(villagerOption, {
                onNone: () => Effect.void,
                onSome: (villager) =>
                  Effect.gen(function* () {
                    const opened = yield* tradingPresentation.open(villager.villagerId)
                    if (opened) {
                      yield* Ref.set(gamePausedRef, true)
                    }
                  }),
              })
            }
          }
        }

        const tradeOpenAfterToggles = yield* tradingPresentation.isOpen()

        if (tradeOpenAfterToggles) {
          if (tradePrevPressed) {
            yield* tradingPresentation.cycleSelection(-1)
          }
          if (tradeNextPressed) {
            yield* tradingPresentation.cycleSelection(1)
          }
          if (tradeExecutePressed) {
            yield* tradingPresentation.executeSelectedTrade()
          }
          yield* tradingPresentation.refresh()
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
      yield* Effect.sync(() => {
        if (deps.lights.light.castShadow !== currentSettings.shadowsEnabled) {
          deps.lights.light.castShadow = currentSettings.shadowsEnabled
        }
      })

      // 7. Handle block interaction (break/place) and hotbar (suppressed when paused)
      yield* Effect.gen(function* () {
        const paused = yield* Ref.get(gamePausedRef)
        if (paused) return

        // Update hotbar slot selection (keyboard 1-9 and mouse wheel)
        yield* hotbarService.update()

        // Process block break/place clicks
        const leftClick = yield* inputService.consumeMouseClick(0)
        const rightClick = yield* inputService.consumeMouseClick(2)
        const [placeWirePressed, placeLeverPressed, placeButtonPressed, placeTorchPressed, placePistonPressed, toggleLeverPressed, pressButtonPressed, toggleTorchPressed] = yield* Effect.all([
          inputService.consumeKeyPress(REDSTONE_PLACE_WIRE_KEY),
          inputService.consumeKeyPress(REDSTONE_PLACE_LEVER_KEY),
          inputService.consumeKeyPress(REDSTONE_PLACE_BUTTON_KEY),
          inputService.consumeKeyPress(REDSTONE_PLACE_TORCH_KEY),
          inputService.consumeKeyPress(REDSTONE_PLACE_PISTON_KEY),
          inputService.consumeKeyPress(REDSTONE_TOGGLE_LEVER_KEY),
          inputService.consumeKeyPress(REDSTONE_PRESS_BUTTON_KEY),
          inputService.consumeKeyPress(REDSTONE_TOGGLE_TORCH_KEY),
        ], { concurrency: 'unbounded' })

        const hasRedstoneInput =
          placeWirePressed ||
          placeLeverPressed ||
          placeButtonPressed ||
          placeTorchPressed ||
          placePistonPressed ||
          toggleLeverPressed ||
          pressButtonPressed ||
          toggleTorchPressed

        if (leftClick || rightClick || hasRedstoneInput) {
          const targetBlock = yield* blockHighlight.getTargetBlock()
          const targetHit = yield* blockHighlight.getTargetHit()

          if (hasRedstoneInput) {
            yield* Option.match(targetBlock, {
              onNone: () => Effect.void,
              onSome: (tb) =>
                Effect.gen(function* () {
                  const position = { x: tb.x, y: tb.y, z: tb.z }

                  if (placeWirePressed) {
                    yield* redstoneService.setComponent(position, RedstoneComponentType.Wire)
                  }
                  if (placeLeverPressed) {
                    yield* redstoneService.setComponent(position, RedstoneComponentType.Lever)
                  }
                  if (placeButtonPressed) {
                    yield* redstoneService.setComponent(position, RedstoneComponentType.Button)
                  }
                  if (placeTorchPressed) {
                    yield* redstoneService.setComponent(position, RedstoneComponentType.Torch)
                  }
                  if (placePistonPressed) {
                    yield* redstoneService.setComponent(position, RedstoneComponentType.Piston)
                  }
                  if (toggleLeverPressed) {
                    yield* redstoneService.toggleLever(position)
                  }
                  if (pressButtonPressed) {
                    yield* redstoneService.pressButton(position)
                  }
                  if (toggleTorchPressed) {
                    yield* redstoneService.toggleTorch(position)
                  }
                }),
            })

            yield* redstoneService.tick()
          }

          if (leftClick) yield* Option.match(targetBlock, {
            onNone: () => Effect.void,
            onSome: (tb) => Effect.gen(function* () {
              yield* blockService.breakBlock({ x: tb.x, y: tb.y, z: tb.z })
              yield* soundManager.playEffect('blockBreak', { position: { x: tb.x, y: tb.y, z: tb.z } })
              // Re-mesh the affected chunk
              const chunkCoord = { x: Math.floor(tb.x / CHUNK_SIZE), z: Math.floor(tb.z / CHUNK_SIZE) }
              const updatedChunk = yield* chunkManagerService.getChunk(chunkCoord)
              yield* worldRendererService.updateChunkInScene(updatedChunk, scene)
            }),
          })

          if (rightClick) yield* Option.match(targetHit, {
            onNone: () => Effect.void,
            onSome: (hit) => Effect.gen(function* () {
              const adjacentPos = {
                x: hit.blockX + Math.round(hit.normal.x),
                y: hit.blockY + Math.round(hit.normal.y),
                z: hit.blockZ + Math.round(hit.normal.z),
              }
              const selectedBlock = yield* hotbarService.getSelectedBlockType()
              yield* Option.match(selectedBlock, {
                onNone: () => Effect.void,
                onSome: (blockType) => Effect.gen(function* () {
                  yield* blockService.placeBlock(adjacentPos, blockType)
                  yield* soundManager.playEffect('blockPlace', { position: adjacentPos })
                  // Re-mesh the affected chunk
                  const chunkCoord = { x: Math.floor(adjacentPos.x / CHUNK_SIZE), z: Math.floor(adjacentPos.z / CHUNK_SIZE) }
                  const updatedChunk = yield* chunkManagerService.getChunk(chunkCoord)
                  yield* worldRendererService.updateChunkInScene(updatedChunk, scene)
                }),
              })
            }),
          })
        }

        // Update hotbar renderer with current slot state
        const slots = yield* hotbarService.getSlots()
        const selectedSlot = yield* hotbarService.getSelectedSlot()
        yield* hotbarRenderer.update(slots, selectedSlot)
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Block interaction error: ${Cause.pretty(cause)}`)))

      // 9. Update FPS display — tick first to include this frame in the measurement,
      //    then read the updated average so the display reflects the current frame.
      yield* fpsCounter.tick(deltaTime)
      const fps = yield* fpsCounter.getFPS()
      yield* Effect.sync(() => { Option.map(fpsElement, (el) => { el.textContent = fps.toFixed(1) }) })

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
      yield* Effect.sync(() => {
        if (deps.gtaoPass) deps.gtaoPass.enabled = currentSettings.ssaoEnabled && renderer.capabilities.isWebGL2
        if (deps.bloomPass) deps.bloomPass.enabled = currentSettings.bloomEnabled
        if (deps.dofPass) deps.dofPass.enabled = currentSettings.dofEnabled
        if (deps.smaaPass) deps.smaaPass.enabled = currentSettings.smaaEnabled
      })

      const ssrPass = deps.ssrPass
      if (ssrPass) {
        if (currentSettings.ssrEnabled && renderer.capabilities.isWebGL2) {
          const waterMeshes = yield* worldRendererService.getWaterMeshes()
          yield* Effect.sync(() => {
            ssrPass.selects = waterMeshes as THREE.Mesh[]
            ssrPass.enabled = true
          })
        } else {
          yield* Effect.sync(() => { ssrPass.enabled = false })
        }
      }

      yield* Effect.sync(() => {
        const godRaysPass = deps.godRaysPass
        if (godRaysPass) {
          if (currentSettings.godRaysEnabled) {
            const lightPos = (deps.lights.light as unknown as THREE.DirectionalLight).position
            sunWorldPos.copy(lightPos).normalize().multiplyScalar(100)
            sunWorldPos.project(camera)
            // Convert NDC [-1,1] to screen UV [0,1]
            godRaysPass.sunScreenPos.set(
              (sunWorldPos.x + 1) * 0.5,
              (sunWorldPos.y + 1) * 0.5,
            )
            godRaysPass.enabled = true
          } else {
            godRaysPass.enabled = false
          }
        }
      })

      // Render via EffectComposer (disabled passes are skipped automatically)
      yield* Effect.sync(() => {
        if (deps.composer) {
          deps.composer.render()
        } else {
          renderer.render(scene, camera)
        }
      })

      // 11. Render HUD hotbar overlay (second pass; autoClear=false prevents erasing the main scene)
      yield* Effect.sync(() => { renderer.autoClear = false })
      yield* hotbarRenderer.render(renderer).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`HUD render error: ${Cause.pretty(cause)}`))
      )
      yield* Effect.sync(() => { renderer.autoClear = true })
    })
  })
