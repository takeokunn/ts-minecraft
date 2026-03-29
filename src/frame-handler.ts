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
import { Cause, Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { GodRaysPass } from '@/infrastructure/three/god-rays-pass'
import { GameStateService } from '@/application/game-state'
import { DEFAULT_PLAYER_ID } from '@/application/constants'
import { MAX_SHADOW_HALF_EXTENT } from '@/shared/rendering-constants'
import { PlayerCameraStateService } from '@/application/camera/camera-state'
import { FirstPersonCameraService } from '@/application/camera/first-person-camera-service'
import { ThirdPersonCameraService } from '@/application/camera/third-person-camera-service'
import { BlockService } from '@/application/block/block-service'
import { HotbarService } from '@/application/hotbar/hotbar-service'
import { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import { TimeService } from '@/application/time/time-service'
import { SettingsService, resolvePreset, type ResolvedGraphics } from '@/application/settings/settings-service'
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
import { type Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
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
  readonly composer: Option.Option<EffectComposer>
  readonly skyMesh: Option.Option<THREE.Object3D>
  readonly gtaoPass: Option.Option<GTAOPass>
  readonly bloomPass: Option.Option<UnrealBloomPass>
  readonly dofPass: Option.Option<BokehPass>
  readonly godRaysPass: Option.Option<GodRaysPass>
  readonly smaaPass: Option.Option<SMAAPass>
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
    // Refraction pre-pass frame counter: only render every N frames based on quality preset
    const refractionFrameCounterRef = yield* Ref.make(0)
    // Track whether the refraction texture has been rendered at least once —
    // prevents water shader from sampling a black/stale refraction texture on startup.
    const refractionValidRef = yield* Ref.make(false)
    // FPS display throttle: skip DOM write when displayed value is unchanged
    const lastFpsTextRef = yield* Ref.make('')
    // Health display throttle: skip DOM write when health values are unchanged (FR-006)
    const lastHealthRef = MutableRef.make({ current: -1, max: -1 })
    const lastLoadedChunksRef = yield* Ref.make<Option.Option<ReadonlyArray<Chunk>>>(Option.none())
    // Track last renderDistance to avoid per-frame shadow camera updateProjectionMatrix
    const lastRenderDistanceRef = yield* Ref.make(0)
    // Track last graphicsQuality + resolved preset to skip resolvePreset and pass enable sync when preset is unchanged
    const lastGraphicsQualityRef = yield* Ref.make<{ quality: string; resolved: ResolvedGraphics }>({ quality: '', resolved: resolvePreset('high') })
    // Dirty chunk accumulator: deduplicates block break/place remesh calls within a single frame
    const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, Chunk>())

    // Pre-allocated for god rays sun position projection — reused each frame to avoid GC
    const sunWorldPos = yield* Effect.sync(() => new THREE.Vector3())

    // FR-009: Cache last shadow target position — skip updateMatrixWorld when player hasn't moved significantly
    const lastShadowTargetRef = MutableRef.make({ x: NaN, z: NaN })
    // FR-005: Skip audio applySettings when volume/enabled haven't changed
    const lastAudioRef = MutableRef.make({ enabled: false, master: -1, sfx: -1, music: -1 })
    // FR-012: Cache last chunk coordinate lookup for ground-Y scan — avoids per-frame getChunk
    // + object allocation when the player stays within the same chunk. NaN ensures first fetch.
    const lastChunkLookupRef = MutableRef.make<{ cx: number; cz: number; chunk: Option.Option<Chunk> }>({ cx: NaN, cz: NaN, chunk: Option.none() })

    // Pre-computed lights variant with sky disabled — avoids per-frame object spread
    const lightsWithoutSky: DayNightLights = { ...deps.lights, sky: Option.none() }

    // FR-004: Pre-resolve Option deps that never change between frames.
    // Eliminates Option.match dispatch overhead on every frame for fixed references.
    const skyMeshOrNull = Option.getOrNull(deps.skyMesh)
    const fpsElementOrNull = Option.getOrNull(deps.fpsElement)
    const healthValueElementOrNull = Option.getOrNull(deps.healthValueElement)
    const healthMaxElementOrNull = Option.getOrNull(deps.healthMaxElement)
    const composerOrNull = Option.getOrNull(deps.composer)
    const gtaoPassOrNull = Option.getOrNull(deps.gtaoPass)
    const bloomPassOrNull = Option.getOrNull(deps.bloomPass)
    const dofPassOrNull = Option.getOrNull(deps.dofPass)
    const smaaPassOrNull = Option.getOrNull(deps.smaaPass)
    const godRaysPassOrNull = Option.getOrNull(deps.godRaysPass)

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

      const { renderer, scene, camera, gamePausedRef } = deps

      // Accumulate total elapsed time for water shader uniform
      const totalTimeSecs = yield* Ref.updateAndGet(totalTimeSecsRef, (t) => t + deltaTime)

      // Fetch settings once per frame for shadow/SSAO and day-length reactive changes
      const currentSettings = yield* settingsService.getSettings()

      // Derive effective lights: conditionally nullify sky port based on preset
      // Cache resolvePreset result — only recompute when graphicsQuality changes
      const [resolvedGraphics, graphicsChanged] = yield* Ref.modify(
        lastGraphicsQualityRef,
        (last): [[ResolvedGraphics, boolean], { quality: string; resolved: ResolvedGraphics }] => {
          if (last.quality === currentSettings.graphicsQuality) return [[last.resolved, false], last]
          const next = { quality: currentSettings.graphicsQuality, resolved: resolvePreset(currentSettings.graphicsQuality) }
          return [[next.resolved, true], next]
        }
      )
      const effectiveLights = resolvedGraphics.skyEnabled
        ? deps.lights
        : lightsWithoutSky
      yield* Effect.sync(() => { if (skyMeshOrNull) skyMeshOrNull.visible = resolvedGraphics.skyEnabled })

      // Hoist player position — shared across steps 1, 3.5, and 8 to avoid redundant Effect calls
      const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
        Effect.catchAllCause(() => Effect.succeed(FALLBACK_PLAYER_POS))
      )

      // Audio settings (FR-005: skip applySettings when values haven't changed)
      const lastAudio = MutableRef.get(lastAudioRef)
      const audioChanged = lastAudio.enabled !== currentSettings.audioEnabled ||
        lastAudio.master !== currentSettings.masterVolume ||
        lastAudio.sfx !== currentSettings.sfxVolume ||
        lastAudio.music !== currentSettings.musicVolume
      if (audioChanged) {
        MutableRef.set(lastAudioRef, {
          enabled: currentSettings.audioEnabled,
          master: currentSettings.masterVolume,
          sfx: currentSettings.sfxVolume,
          music: currentSettings.musicVolume,
        })
        yield* Effect.all([
          soundManager.applySettings({
            enabled: currentSettings.audioEnabled,
            masterVolume: currentSettings.masterVolume,
            sfxVolume: currentSettings.sfxVolume,
          }),
          musicManager.applySettings({
            enabled: currentSettings.audioEnabled,
            masterVolume: currentSettings.masterVolume,
            musicVolume: currentSettings.musicVolume,
          }),
        ], { concurrency: 'unbounded', discard: true })
      }
      // Listener position updates every frame (player moves)
      yield* soundManager.setListenerPosition(playerPos)

      // 1. Chunk streaming (throttled internally to 200ms)
      yield* Effect.gen(function* () {
        yield* chunkManagerService.loadChunksAroundPlayer(playerPos)
        const [loadedChunks, lastLoadedChunks] = yield* Effect.all([
          chunkManagerService.getLoadedChunks(),
          Ref.get(lastLoadedChunksRef),
        ], { concurrency: 'unbounded' })
        const chunksChanged = Option.match(lastLoadedChunks, {
          onNone: () => true,
          onSome: (previousLoadedChunks) => previousLoadedChunks !== loadedChunks,
        })

        if (chunksChanged) {
          const [fullySynced] = yield* Effect.all([
            worldRendererService.syncChunksToScene(loadedChunks, scene),
            fluidService.syncLoadedChunks(loadedChunks),
          ], { concurrency: 'unbounded' })
          // Only cache loadedChunks when all new chunk meshes were built this frame.
          // When throttled (fullySynced=false), keep lastLoadedChunksRef stale so
          // the next frame re-enters this branch and processes remaining chunks.
          if (fullySynced) {
            yield* Ref.set(lastLoadedChunksRef, Option.some(loadedChunks))
          }
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
        // FR-012: Cache chunk lookup — skip getChunk when player stays in the same chunk.
        // NaN initial values guarantee the first frame always fetches.
        const lastLookup = MutableRef.get(lastChunkLookupRef)
        let playerChunkOpt: Option.Option<Chunk>
        if (lastLookup.cx === cx && lastLookup.cz === cz) {
          playerChunkOpt = lastLookup.chunk
        } else {
          playerChunkOpt = yield* chunkManagerService.getChunk({ x: cx, z: cz }).pipe(
            Effect.map(Option.some<Chunk>),
            Effect.catchAllCause(() => Effect.succeed(Option.none<Chunk>()))
          )
          MutableRef.set(lastChunkLookupRef, { cx, cz, chunk: playerChunkOpt })
        }
        yield* Option.match(playerChunkOpt, {
          onNone: () => Effect.void,
          onSome: (playerChunk) => {
            // Performance boundary: imperative downward scan avoids allocating an array of
            // ~65-257 elements (Arr.makeBy) plus Option wrappers per blockIndex call each frame.
            const startY = Math.min(Math.floor(playerPos.y) + 1, CHUNK_HEIGHT - 1)
            let surfaceY = 0
            for (let y = startY; y >= 0; y--) {
              if (playerChunk.blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] !== 0) {
                surfaceY = y + 1
                break
              }
            }
            return gameState.updateGroundY(surfaceY)
          },
        })
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Chunk streaming error: ${Cause.pretty(cause)}`)))

      // 2. Day/night cycle: advance time and update lighting + sky color
      yield* updateDayNightCycle(deltaTime, effectiveLights, timeService).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Day/night error: ${Cause.pretty(cause)}`))
      )

      yield* timeService.isNight().pipe(
        Effect.flatMap((isNight) => musicManager.updateFromContext({ isNight, playerPosition: playerPos })),
        Effect.catchAllCause((cause) => Effect.logError(`Music update error: ${Cause.pretty(cause)}`))
      )

      // 2.5. Entity system: spawn and update AI state machine
      yield* mobSpawner.trySpawn(playerPos).pipe(
        Effect.andThen(entityManager.update(deltaTime, playerPos)),
        Effect.catchAllCause((cause) => Effect.logError(`Entity system error: ${Cause.pretty(cause)}`))
      )

      // 2.75. Village simulation update (deterministic generation + villager AI)
      yield* timeService.getTimeOfDay().pipe(
        Effect.flatMap((timeOfDay) => villageService.update(playerPos, timeOfDay, deltaTime)),
        Effect.catchAllCause((cause) => Effect.logError(`Village system error: ${Cause.pretty(cause)}`))
      )

      // 2.9. Redstone simulation tick (fixed-step propagation)
      yield* Ref.modify(redstoneTickAccumulatorRef, (accumulated) => {
        const newAccumulated = accumulated + deltaTime
        const ticks = Math.floor(newAccumulated / REDSTONE_TICK_INTERVAL_SECS)
        const remainder = newAccumulated - ticks * REDSTONE_TICK_INTERVAL_SECS
        return [ticks, remainder]
      }).pipe(
        Effect.flatMap((ticksToRun) =>
          ticksToRun === 1
            ? redstoneService.tick().pipe(Effect.asVoid)
            : ticksToRun > 1
              ? Effect.repeatN(redstoneService.tick(), ticksToRun - 1).pipe(Effect.asVoid)
              : Effect.void
        ),
        Effect.catchAllCause((cause) => Effect.logError(`Redstone system error: ${Cause.pretty(cause)}`))
      )

      // 2.95. Fluid simulation tick (fixed-step propagation)
      yield* Ref.modify(fluidTickAccumulatorRef, (accumulated) => {
        const newAccumulated = accumulated + deltaTime
        const ticks = Math.floor(newAccumulated / FLUID_TICK_INTERVAL_SECS)
        const remainder = newAccumulated - ticks * FLUID_TICK_INTERVAL_SECS
        return [ticks, remainder]
      }).pipe(
        Effect.flatMap((ticksToRun) =>
          ticksToRun === 1
            ? fluidService.tick().pipe(Effect.asVoid)
            : ticksToRun > 1
              ? Effect.repeatN(fluidService.tick(), ticksToRun - 1).pipe(Effect.asVoid)
              : Effect.void
        ),
        Effect.catchAllCause((cause) => Effect.logError(`Fluid system error: ${Cause.pretty(cause)}`))
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
          yield* soundManager.playEffect('playerHurt', { position: playerPos })
        }
        yield* healthService.tick()
        const health = yield* healthService.getHealth()
        // Pre-cached element refs (resolved once at startup in FrameHandlerDeps)
        // FR-006: Only write DOM when health values actually change
        const lastHealth = MutableRef.get(lastHealthRef)
        if (lastHealth.current !== health.current || lastHealth.max !== health.max) {
          MutableRef.set(lastHealthRef, { current: health.current, max: health.max })
          yield* Effect.sync(() => {
            if (healthValueElementOrNull) healthValueElementOrNull.textContent = String(health.current)
            if (healthMaxElementOrNull) healthMaxElementOrNull.textContent = String(health.max)
          })
        }
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Health error: ${Cause.pretty(cause)}`)))

      // 4. Update camera rotation from mouse look (suppressed when a modal is open)
      yield* Ref.get(gamePausedRef).pipe(
        Effect.flatMap((paused) => paused ? Effect.void : firstPersonCamera.update(camera, currentSettings.mouseSensitivity))
      )

      // 4.5. Handle view toggle: F5 switches first/third person before raycasting
      yield* inputService.consumeKeyPress(KeyMappings.CAMERA_TOGGLE).pipe(
        Effect.flatMap((pressed) => pressed ? playerCameraState.toggleMode() : Effect.void),
        Effect.catchAllCause((cause) => Effect.logError(`Camera toggle error: ${Cause.pretty(cause)}`))
      )

      // 4.6. Camera perspective + position sync (use current mode before raycasting)
      yield* Effect.all(
        [playerCameraState.getRotation(), playerCameraState.getMode()],
        { concurrency: 'unbounded' }
      ).pipe(
        Effect.flatMap(([rotation, cameraMode]) =>
          cameraMode === 'firstPerson'
            ? Effect.sync(() => {
                const eyeY = playerPos.y + EYE_LEVEL_OFFSET
                camera.position.set(playerPos.x, eyeY, playerPos.z)
                camera.rotation.set(rotation.pitch, rotation.yaw, 0, 'YXZ')
              })
            : thirdPersonCamera.update(camera, playerPos, EYE_LEVEL_OFFSET)
        ),
        // Shadow frustum follows player so terrain around them is always shadow-covered
        // FR-009: Only update when player has moved more than 0.5 blocks (avoids per-frame updateMatrixWorld)
        Effect.andThen(Effect.sync(() => {
          const lastTarget = MutableRef.get(lastShadowTargetRef)
          const dx = playerPos.x - lastTarget.x
          const dz = playerPos.z - lastTarget.z
          if (dx * dx + dz * dz > 0.25) {
            MutableRef.set(lastShadowTargetRef, { x: playerPos.x, z: playerPos.z })
            deps.lights.light.target.position.set(playerPos.x, 0, playerPos.z)
            deps.lights.light.target.updateMatrixWorld()
          }
        })),
        // Dynamic shadow frustum: tighten bounds to renderDistance for higher texel density.
        // Only update when renderDistance changes (avoids per-frame updateProjectionMatrix).
        Effect.andThen(Ref.modify(lastRenderDistanceRef, (lastRd): [boolean, number] =>
          lastRd === currentSettings.renderDistance ? [false, lastRd] : [true, currentSettings.renderDistance]
        )),
        Effect.flatMap((changed) => changed
          ? Effect.sync(() => {
              // Dynamic camera far plane: keep Z-buffer precision tight to visible range
              camera.far = Math.max(currentSettings.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300)
              camera.updateProjectionMatrix()
              // Shadow frustum: tighten bounds to renderDistance for higher texel density
              const halfExtent = Math.min(Math.ceil(currentSettings.renderDistance * CHUNK_SIZE * 0.5), MAX_SHADOW_HALF_EXTENT)
              const cam = (deps.lights.light as unknown as THREE.DirectionalLight).shadow.camera
              cam.far = Math.max(currentSettings.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300)
              cam.left = -halfExtent
              cam.right = halfExtent
              cam.top = halfExtent
              cam.bottom = -halfExtent
              cam.updateProjectionMatrix()
            })
          : Effect.void
        )
      )

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
                  tradingPresentation.open(villager.villagerId).pipe(
                    Effect.flatMap((opened) => opened ? Ref.set(gamePausedRef, true) : Effect.void)
                  ),
              })
            }
          }
        }

        // FR-007: Early-exit guard — when no overlay is open (gamePausedRef=false),
        // skip trading navigation/refresh and inventory update entirely.
        // This avoids per-frame Effect allocations (tradingPresentation.isOpen Ref.get,
        // inventoryRenderer.update Effect.gen + Ref.get) when overlays are closed.
        const anyOverlayOpen = yield* Ref.get(gamePausedRef)

        if (anyOverlayOpen) {
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

          yield* inventoryRenderer.update()
        }

        // Sync day length to TimeService in case user applied settings changes
        // Guard: only update if the value has actually changed (avoids 60 allocs/sec)
        const currentDayLength = yield* timeService.getDayLength()
        if (currentDayLength !== currentSettings.dayLengthSeconds) {
          yield* timeService.setDayLength(currentSettings.dayLengthSeconds)
        }
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Overlay error: ${Cause.pretty(cause)}`)))

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
            onSome: (tb) => {
              const pos = { x: tb.x, y: tb.y, z: tb.z }
              const chunkCoord = { x: Math.floor(tb.x / CHUNK_SIZE), z: Math.floor(tb.z / CHUNK_SIZE) }
              const coordKey = `${chunkCoord.x},${chunkCoord.z}`
              return Effect.all([
                blockService.breakBlock(pos),
                soundManager.playEffect('blockBreak', { position: pos }),
              ], { concurrency: 'unbounded', discard: true }).pipe(
                Effect.andThen(chunkManagerService.getChunk(chunkCoord)),
                Effect.flatMap((updatedChunk) => Ref.update(dirtyChunksRef, (map) => HashMap.set(map, coordKey, updatedChunk)))
              )
            },
          })

          if (rightClick) yield* Option.match(targetHit, {
            onNone: () => Effect.void,
            onSome: (hit) => {
              const adjacentPos = {
                x: hit.blockX + Math.round(hit.normal.x),
                y: hit.blockY + Math.round(hit.normal.y),
                z: hit.blockZ + Math.round(hit.normal.z),
              }
              return hotbarService.getSelectedBlockType().pipe(
                Effect.flatMap((selectedBlock) => Option.match(selectedBlock, {
                  onNone: () => Effect.void,
                  onSome: (blockType) => {
                    const chunkCoord = { x: Math.floor(adjacentPos.x / CHUNK_SIZE), z: Math.floor(adjacentPos.z / CHUNK_SIZE) }
                    const coordKey = `${chunkCoord.x},${chunkCoord.z}`
                    return Effect.all([
                      blockService.placeBlock(adjacentPos, blockType),
                      soundManager.playEffect('blockPlace', { position: adjacentPos }),
                    ], { concurrency: 'unbounded', discard: true }).pipe(
                      Effect.andThen(chunkManagerService.getChunk(chunkCoord)),
                      Effect.flatMap((updatedChunk) => Ref.update(dirtyChunksRef, (map) => HashMap.set(map, coordKey, updatedChunk)))
                    )
                  },
                }))
              )
            },
          })
        }

        // Update hotbar renderer with current slot state
        const [slots, selectedSlot] = yield* Effect.all([
          hotbarService.getSlots(),
          hotbarService.getSelectedSlot(),
        ], { concurrency: 'unbounded' })
        yield* hotbarRenderer.update(slots, selectedSlot)
      }).pipe(Effect.catchAllCause((cause) => Effect.logError(`Block interaction error: ${Cause.pretty(cause)}`)))

      // 9. Update FPS display — tick first, then update DOM only when displayed value changes
      const fps = yield* fpsCounter.tick(deltaTime).pipe(
        Effect.andThen(fpsCounter.getFPS())
      )
      const fpsText = fps.toFixed(1)
      const fpsChanged = yield* Ref.modify(lastFpsTextRef, (last): [boolean, string] =>
        last === fpsText ? [false, last] : [true, fpsText]
      )
      if (fpsChanged && fpsElementOrNull) {
        yield* Effect.sync(() => { fpsElementOrNull.textContent = fpsText })
      }

      // 9.5. Refraction pre-pass for water shader — throttled by quality preset
      // low=skip entirely, medium=every 3 frames, high=every 2, ultra=every frame
      // Counter uses (n-1) so the first frame always runs (no initial-frame stutter).
      if (resolvedGraphics.refractionThrottleFrames > 0) {
        const refractionFrame = yield* Ref.updateAndGet(refractionFrameCounterRef, (n) => n + 1)
        if ((refractionFrame - 1) % resolvedGraphics.refractionThrottleFrames === 0) {
          yield* worldRendererService.doRefractionPrePass(deps.renderer, deps.scene, deps.camera).pipe(
            Effect.catchAllCause((cause) => Effect.logError(`Refraction pre-pass error: ${Cause.pretty(cause)}`))
          )
          yield* Ref.getAndSet(refractionValidRef, true).pipe(
            Effect.flatMap((wasValid) => wasValid ? Effect.void : worldRendererService.setRefractionValid(true))
          )
        }
      }

      // Update water uniforms (time + camera position only — resolution is set on resize)
      yield* worldRendererService.updateWaterUniforms(
        totalTimeSecs,
        deps.camera.position,
      )

      // 10. Sync pass enable states from graphics quality preset, then render via EffectComposer
      // graphicsChanged is computed earlier alongside resolvedGraphics (FR-012 cache)
      // FR-014: disabled passes still hold full-resolution render targets that waste VRAM.
      // On transition: disabled→setSize(1,1) shrinks RTs; enabled→setSize(w,h) restores them.
      if (graphicsChanged) {
        yield* Effect.sync(() => {
          const w = renderer.domElement.clientWidth || 1
          const h = renderer.domElement.clientHeight || 1
          if (deps.lights.light.castShadow !== resolvedGraphics.shadowsEnabled) {
            deps.lights.light.castShadow = resolvedGraphics.shadowsEnabled
          }
          if (gtaoPassOrNull) {
            const enabled = resolvedGraphics.ssaoEnabled && renderer.capabilities.isWebGL2
            gtaoPassOrNull.enabled = enabled
            // FR-014: Half-resolution GTAO — 75% fill reduction with acceptable quality loss
            gtaoPassOrNull.setSize(enabled ? Math.ceil(w / 2) : 1, enabled ? Math.ceil(h / 2) : 1)
          }
          if (bloomPassOrNull) {
            bloomPassOrNull.enabled = resolvedGraphics.bloomEnabled; bloomPassOrNull.strength = resolvedGraphics.bloomStrength
            bloomPassOrNull.setSize(resolvedGraphics.bloomEnabled ? w : 1, resolvedGraphics.bloomEnabled ? h : 1)
          }
          if (dofPassOrNull) {
            dofPassOrNull.enabled = resolvedGraphics.dofEnabled
            dofPassOrNull.setSize(resolvedGraphics.dofEnabled ? w : 1, resolvedGraphics.dofEnabled ? h : 1)
          }
          if (smaaPassOrNull) {
            smaaPassOrNull.enabled = resolvedGraphics.smaaEnabled
            smaaPassOrNull.setSize(resolvedGraphics.smaaEnabled ? w : 1, resolvedGraphics.smaaEnabled ? h : 1)
          }
          if (godRaysPassOrNull) {
            godRaysPassOrNull.setNumSamples(resolvedGraphics.godRaysSamples)
            godRaysPassOrNull.setSize(resolvedGraphics.godRaysEnabled ? w : 1, resolvedGraphics.godRaysEnabled ? h : 1)
          }
        })
      }

      yield* Effect.sync(() => {
        if (godRaysPassOrNull) {
          if (resolvedGraphics.godRaysEnabled) {
            const lightPos = (deps.lights.light as unknown as THREE.DirectionalLight).position
            sunWorldPos.copy(lightPos).normalize().multiplyScalar(100)
            sunWorldPos.project(camera)
            const sunU = (sunWorldPos.x + 1) * 0.5
            const sunV = (sunWorldPos.y + 1) * 0.5
            const behindCamera = sunWorldPos.z > 1
            const offScreen = sunU < -0.2 || sunU > 1.2 || sunV < -0.2 || sunV > 1.2
            if (behindCamera || offScreen) {
              godRaysPassOrNull.enabled = false
            } else {
              godRaysPassOrNull.sunScreenPos.set(sunU, sunV)
              // FR-003: Adaptive god-rays sample count — reduce by 50% when
              // sun is in the outer 40% of the screen where quality loss is imperceptible.
              const distFromCenter = Math.hypot(sunU - 0.5, sunV - 0.5)
              const baseSamples = resolvedGraphics.godRaysSamples
              const adaptiveSamples = distFromCenter > 0.3
                ? Math.max(5, Math.floor(baseSamples * 0.5))
                : baseSamples
              godRaysPassOrNull.setNumSamples(adaptiveSamples)
              godRaysPassOrNull.enabled = true
            }
          } else {
            godRaysPassOrNull.enabled = false
          }
        }

        if (composerOrNull) {
          composerOrNull.render()
        } else {
          renderer.render(scene, camera)
        }
      })

      // 10.5. Flush dirty chunks — remesh each modified chunk exactly once per frame,
      // deduplicating rapid break/place clicks that target the same chunk.
      yield* Ref.getAndSet(dirtyChunksRef, HashMap.empty()).pipe(
        Effect.flatMap((dirtyChunks) =>
          Effect.forEach(
            HashMap.values(dirtyChunks),
            (chunk) => worldRendererService.updateChunkInScene(chunk, scene),
            { concurrency: 1, discard: true }
          )
        ),
        Effect.catchAllCause((cause) => Effect.logError(`Dirty chunk flush error: ${Cause.pretty(cause)}`))
      )

      // 11. Render HUD hotbar overlay (second pass; autoClear=false prevents erasing the main scene)
      yield* Effect.sync(() => { renderer.autoClear = false }).pipe(
        Effect.andThen(hotbarRenderer.render(renderer)),
        Effect.andThen(Effect.sync(() => { renderer.autoClear = true })),
        Effect.catchAllCause((cause) => Effect.logError(`HUD render error: ${Cause.pretty(cause)}`))
      )
    })
  })
