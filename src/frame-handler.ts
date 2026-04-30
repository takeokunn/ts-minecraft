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
import { Array as Arr, Cause, Effect, HashMap, MutableRef, Option, Ref } from 'effect'
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
import { HOTBAR_START } from '@/application/inventory/inventory-service'
import { SlotIndex } from '@/shared/kernel'
import { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import { TimeService } from '@/application/time/time-service'
import { SettingsService, resolvePreset, type ResolvedGraphics } from '@/application/settings/settings-service'
import { FPSCounterService } from '@/presentation/fps-counter'
import { HotbarRendererService } from '@/presentation/hud/hotbar-three'
import { BlockHighlightService } from '@/presentation/highlight/block-highlight'
import { WorldRendererService } from '@/infrastructure/three/world-renderer'
import { EntityRendererService } from '@/infrastructure/three/entity-renderer'
import { ChunkMeshService } from '@/infrastructure/three/meshing/chunk-mesh'
import { InputService } from '@/presentation/input/input-service'
import { KeyMappings } from '@/application/input/key-mappings'
import { SettingsOverlayService } from '@/presentation/settings/settings-overlay'
import { InventoryRendererService } from '@/presentation/inventory/inventory-renderer'
import { InventoryService } from '@/application/inventory/inventory-service'
import { HealthService } from '@/application/player/health-service'
import { MusicManager, SoundManager } from '@/audio'
import { EntityManager } from '@/entity/entityManager'
import { MobSpawner } from '@/entity/spawner'
import { VillageService } from '@/village/village-service'
import { TradingPresentationService } from '@/presentation/trading'
import { RedstoneComponentType } from '@/redstone/redstone-model'
import { RedstoneService } from '@/redstone/redstone-service'
import { FluidService } from '@/application/fluid/fluid-service'
import { FurnaceService } from '@/application/furnace/furnace-service'
import { type Chunk, CHUNK_SIZE, CHUNK_HEIGHT, indexToBlockType } from '@/domain/chunk'
import type { EntityId as EntityIdType } from '@/entity/entity'
import { updateDayNightCycle, type DayNightLights } from '@/application/time/day-night-cycle'
import type { DeltaTimeSecs, Position } from '@/shared/kernel'
import {
  EYE_LEVEL_OFFSET,
  TRADE_DISTANCE, TRADE_OPEN_KEY, TRADE_NEXT_KEY, TRADE_PREV_KEY, TRADE_EXECUTE_KEY,
  REDSTONE_TICK_INTERVAL_SECS, FLUID_TICK_INTERVAL_SECS,
  REDSTONE_PLACE_WIRE_KEY, REDSTONE_PLACE_LEVER_KEY, REDSTONE_PLACE_BUTTON_KEY,
  REDSTONE_PLACE_TORCH_KEY, REDSTONE_PLACE_PISTON_KEY,
  REDSTONE_TOGGLE_LEVER_KEY, REDSTONE_PRESS_BUTTON_KEY, REDSTONE_TOGGLE_TORCH_KEY,
  PLAYER_ATTACK_REACH, PLAYER_ATTACK_RADIUS, PLAYER_ATTACK_DAMAGE, WOODEN_SWORD_ATTACK_DAMAGE,
  FALLBACK_PLAYER_POS,
} from './frame-handler.config'
import {
  advanceFixedStep,
  captureCameraPose,
  decideAdaptiveQuality,
  hasCameraPoseChanged,
} from '@/frame/frame-runtime-logic'
import { createMaintenanceHandler } from '@/frame/frame-maintenance'

/**
 * Three.js objects and DOM state that live outside the Effect layer graph.
 * These are mutable references passed by value at startup — not Effect services —
 * because they are created and owned by main.ts before the game loop starts.
 * `gamePausedRef` is a Ref rather than a dedicated service to avoid introducing
 * a `GamePauseService` for a single boolean that only frame-handler reads/writes.
 */
export type FrameHandlerDeps = {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly respawnPosition: Position
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
export type FrameHandlerServices = {
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
  readonly inventoryService: InventoryService
  readonly fpsCounter: FPSCounterService
  readonly healthService: HealthService
  readonly worldRendererService: WorldRendererService
  readonly entityRenderer: EntityRendererService
  readonly chunkMeshService: ChunkMeshService
  readonly soundManager: SoundManager
  readonly musicManager: MusicManager
  readonly entityManager: EntityManager
  readonly mobSpawner: MobSpawner
  readonly villageService: VillageService
  readonly tradingPresentation: TradingPresentationService
  readonly redstoneService: RedstoneService
  readonly fluidService: FluidService
  readonly furnaceService: FurnaceService
}

export type FrameLoopHandlers = {
  readonly frameHandler: (deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>
  readonly maintenanceHandler: () => Effect.Effect<boolean, never>
}

const findAttackableEntity = (
  entities: ReadonlyArray<{ readonly entityId: EntityIdType; readonly position: Position }>,
  camera: THREE.PerspectiveCamera,
  maxDistance: Option.Option<number>,
): Option.Option<EntityIdType> => {
  const cameraDirection = new THREE.Vector3()
  camera.getWorldDirection(cameraDirection)
  cameraDirection.normalize()

  const rayOrigin = camera.position
  let closestEntityId: EntityIdType | null = null
  let closestDistance = Infinity

  Arr.forEach(entities, (entity) => {
    const toEntity = new THREE.Vector3(
      entity.position.x - rayOrigin.x,
      entity.position.y + 0.9 - rayOrigin.y,
      entity.position.z - rayOrigin.z,
    )
    const alongRay = toEntity.dot(cameraDirection)
    if (alongRay < 0 || alongRay > PLAYER_ATTACK_REACH) return
    if (Option.match(maxDistance, { onNone: () => false, onSome: (d) => alongRay > d })) return

    const perpendicularSq = Math.max(0, toEntity.lengthSq() - alongRay * alongRay)
    if (perpendicularSq > PLAYER_ATTACK_RADIUS * PLAYER_ATTACK_RADIUS) return

    if (alongRay < closestDistance) {
      closestDistance = alongRay
      closestEntityId = entity.entityId
    }
  })

  return closestEntityId === null ? Option.none() : Option.some(closestEntityId)
}

const createFrameLoopHandlersInternal = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
): Effect.Effect<FrameLoopHandlers> =>
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
    // Skip chunk streaming work until the player changes chunk or render distance changes.
    const lastChunkStreamingRef = MutableRef.make({ cx: NaN, cz: NaN, renderDistance: NaN })
    // Keep retrying chunk mesh sync until the renderer reports the loaded set is fully synced.
    const chunkSyncPendingRef = MutableRef.make(false)
    // Track last renderDistance to avoid per-frame shadow camera updateProjectionMatrix
    const lastRenderDistanceRef = yield* Ref.make(0)
    const lastEntityStructureVersionRef = yield* Ref.make(-1)
    const shadowUpdateCounterRef = yield* Ref.make(0)
    const frustumThrottleStrideRef = yield* Ref.make(1)
    const frustumThrottleCounterRef = yield* Ref.make(0)
    const adaptiveQualityCooldownRef = yield* Ref.make(0)
    const lastAppliedPixelRatioRef = yield* Ref.make(Number.NaN)
    // Track last graphicsQuality + resolved preset to skip resolvePreset and pass enable sync when preset is unchanged
    const lastGraphicsQualityRef = yield* Ref.make<{ quality: string; resolved: ResolvedGraphics }>({ quality: '', resolved: resolvePreset('high') })
    // Dirty chunk accumulator: deduplicates block break/place remesh calls within a single frame
    const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, Chunk>())

    // Pre-allocated for god rays sun position projection — reused each frame to avoid GC
    const sunWorldPos = yield* Effect.sync(() => new THREE.Vector3())

    // FR-009: Cache last shadow target position — skip updateMatrixWorld when player hasn't moved significantly
    const lastShadowTargetRef = MutableRef.make({ x: NaN, z: NaN })
    // Cache last world-renderer scene version + camera pose for frustum/refraction skips.
    const lastFrustumCullRef = MutableRef.make({ version: -1, x: NaN, y: NaN, z: NaN, qx: NaN, qy: NaN, qz: NaN, qw: NaN })
    const lastRefractionFrameRef = MutableRef.make({ version: -1, x: NaN, y: NaN, z: NaN, qx: NaN, qy: NaN, qz: NaN, qw: NaN })
    // FR-005: Skip audio applySettings when volume/enabled haven't changed
    const lastAudioRef = MutableRef.make({ enabled: false, master: -1, sfx: -1, music: -1 })

    // Pre-computed lights variant with sky disabled — avoids per-frame object spread
    const lightsWithoutSky: DayNightLights = { ...deps.lights, sky: Option.none() }

    // FR-004: Pre-resolve Option deps that never change between frames.
    // Eliminates Option.match dispatch overhead on every frame for fixed references.
    const skyMeshOrNull = Option.getOrNull(deps.skyMesh)
    const fpsElementOrNull = Option.getOrNull(deps.fpsElement)
    const healthValueElementOrNull = Option.getOrNull(deps.healthValueElement)
    const healthMaxElementOrNull = Option.getOrNull(deps.healthMaxElement)
    const gtaoPassOrNull = Option.getOrNull(deps.gtaoPass)
    const bloomPassOrNull = Option.getOrNull(deps.bloomPass)
    const dofPassOrNull = Option.getOrNull(deps.dofPass)
    const smaaPassOrNull = Option.getOrNull(deps.smaaPass)
    const godRaysPassOrNull = Option.getOrNull(deps.godRaysPass)
    const composerOrNull = Option.getOrNull(deps.composer)
    const applyPixelRatioCap = (pixelRatioCap: number): Effect.Effect<boolean, never> =>
      Ref.get(lastAppliedPixelRatioRef).pipe(
        Effect.flatMap((lastAppliedPixelRatio) => {
          const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1
          const nextPixelRatio = Math.min(devicePixelRatio, pixelRatioCap)
          if (Math.abs(lastAppliedPixelRatio - nextPixelRatio) < 0.01) {
            return Effect.succeed(false)
          }
          return Effect.sync(() => {
            const width = deps.renderer.domElement.clientWidth || 1
            const height = deps.renderer.domElement.clientHeight || 1
            deps.renderer.setPixelRatio(nextPixelRatio)
            composerOrNull?.setPixelRatio(nextPixelRatio)
            deps.renderer.setSize(width, height)
            composerOrNull?.setSize(width, height)
          }).pipe(
            Effect.andThen(Ref.set(lastAppliedPixelRatioRef, nextPixelRatio)),
            Effect.as(true)
          )
        })
      )
    const markShadowMapDirty = (): void => {
      if (deps.renderer.shadowMap) {
        deps.renderer.shadowMap.needsUpdate = true
      }
    }
    const maintenanceHandler = createMaintenanceHandler(
      deps,
      services,
      {
        lastLoadedChunksRef,
        lastChunkStreamingRef,
        chunkSyncPendingRef,
        dirtyChunksRef,
      },
    )

    const frameHandler = (deltaTime: DeltaTimeSecs) =>
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
        inventoryService,
        fpsCounter,
        worldRendererService,
        entityRenderer,
        chunkMeshService,
        healthService,
        soundManager,
        musicManager,
        entityManager,
        villageService,
        tradingPresentation,
    redstoneService,
    fluidService,
    furnaceService,
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
      const pixelRatioChanged = yield* applyPixelRatioCap(resolvedGraphics.pixelRatioCap)
      yield* Effect.sync(() => { if (skyMeshOrNull) skyMeshOrNull.visible = resolvedGraphics.skyEnabled })

      // Hoist player position — shared across steps 1, 3.5, and 8 to avoid redundant Effect calls
      const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
        Effect.catchAllCause(() => Effect.succeed(FALLBACK_PLAYER_POS))
      )
      let currentPlayerPos: Position = playerPos

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
      }
      // Listener position updates every frame (player moves)
      yield* soundManager.setListenerPosition(playerPos)

      const sceneVersionBeforeCull = yield* worldRendererService.getSceneVersion()
      const currentFrustumPose = captureCameraPose(camera, sceneVersionBeforeCull)
      const lastFrustumCull = MutableRef.get(lastFrustumCullRef)
      const frustumStride = yield* Ref.get(frustumThrottleStrideRef)
      const frustumTick = yield* Ref.updateAndGet(frustumThrottleCounterRef, (n) => (n + 1) % Math.max(frustumStride, 1))
      if (frustumTick === 0 && hasCameraPoseChanged(lastFrustumCull, currentFrustumPose)) {
        yield* worldRendererService.applyFrustumCulling(camera)
        MutableRef.set(lastFrustumCullRef, currentFrustumPose)
      }

      // 1. Day/night cycle: advance time and update lighting + sky color
      yield* updateDayNightCycle(deltaTime, effectiveLights, timeService).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Day/night error: ${Cause.pretty(cause)}`))
      )
      yield* Ref.updateAndGet(shadowUpdateCounterRef, (n) => (n + 1) % 8).pipe(
        Effect.flatMap((shadowFrame) => shadowFrame === 0 && deps.lights.light.castShadow
          ? Effect.sync(() => {
              markShadowMapDirty()
            })
          : Effect.void)
      )

      yield* timeService.isNight().pipe(
        Effect.flatMap((isNight) => musicManager.updateFromContext({ isNight, playerPosition: playerPos })),
        Effect.catchAllCause((cause) => Effect.logError(`Music update error: ${Cause.pretty(cause)}`))
      )

      // 2.5. Entity simulation stays on the frame lane so visible transforms remain responsive.
      // Slower world simulation (furnace/spawn/village) runs on the maintenance lane.
      const timeOfDay = yield* timeService.getTimeOfDay()
      yield* entityManager.update(deltaTime, playerPos).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Entity system error: ${Cause.pretty(cause)}`))
      )

      // 2.8. Sun-driven shader uniform — derived from the canonical day-factor formula
      // (matches `updateDayNightCycle`'s sin curve so chunk lighting tracks the visible sun).
      const sunIntensity = Math.max(0, Math.sin((timeOfDay - 0.25) * Math.PI * 2))
      yield* chunkMeshService.setSunIntensity(sunIntensity).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Sun intensity sync error: ${Cause.pretty(cause)}`))
      )

      // 2.85. Sync entity meshes with the live entity list and animate transforms.
      // Must run after entityManager.update so the snapshot reflects this frame's positions.
      yield* Effect.all([
        entityManager.getEntities(),
        entityManager.getStructureVersion(),
      ], { concurrency: 'unbounded' }).pipe(
        Effect.flatMap(([entitiesSnapshot, structureVersion]) =>
          Ref.get(lastEntityStructureVersionRef).pipe(
            Effect.flatMap((lastStructureVersion) =>
              (lastStructureVersion === structureVersion
                ? Effect.void
                : entityRenderer.syncEntities(entitiesSnapshot, scene).pipe(
                    Effect.andThen(Ref.set(lastEntityStructureVersionRef, structureVersion))
                  )).pipe(
                Effect.andThen(entityRenderer.updateEntityTransforms(entitiesSnapshot, totalTimeSecs, deltaTime))
              )
            )
          )
        ),
        Effect.catchAllCause((cause) => Effect.logError(`Entity render error: ${Cause.pretty(cause)}`))
      )

      // 2.9. Redstone simulation tick (fixed-step propagation)
      yield* Ref.modify(redstoneTickAccumulatorRef, (accumulated) => {
        const { ticks, remainder } = advanceFixedStep(accumulated, deltaTime, REDSTONE_TICK_INTERVAL_SECS)
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
        const { ticks, remainder } = advanceFixedStep(accumulated, deltaTime, FLUID_TICK_INTERVAL_SECS)
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
        currentPlayerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
          Effect.catchAllCause(() => Effect.succeed(currentPlayerPos))
        )

        const tryApplyPlayerDamage = (amount: number): Effect.Effect<boolean, never> =>
          amount <= 0
            ? Effect.succeed(false)
            : healthService.getHealth().pipe(
                Effect.flatMap((health) =>
                  health.current <= 0 || health.invincibilityTicks > 0
                    ? Effect.succeed(false)
                    : healthService.applyDamage(amount).pipe(Effect.as(true))
                )
              )

        const isGrounded = yield* gameState.isPlayerGrounded()
        const fallDamage = yield* healthService.processFallDamage(currentPlayerPos.y, isGrounded)
        const tookFallDamage = yield* tryApplyPlayerDamage(fallDamage)
        if (tookFallDamage) {
          yield* soundManager.playEffect('playerHurt', { position: currentPlayerPos })
        }

        const hostileDamage = yield* entityManager.getPlayerContactDamage(currentPlayerPos)
        const tookHostileDamage = yield* tryApplyPlayerDamage(hostileDamage)
        if (tookHostileDamage) {
          yield* soundManager.playEffect('playerHurt', { position: currentPlayerPos })
        }

        const isDead = yield* healthService.isDead()
        if (isDead) {
          yield* healthService.reset()
          yield* gameState.respawn(deps.respawnPosition)
          currentPlayerPos = deps.respawnPosition
        } else {
          yield* healthService.tick()
        }

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
                const eyeY = currentPlayerPos.y + EYE_LEVEL_OFFSET
                camera.position.set(currentPlayerPos.x, eyeY, currentPlayerPos.z)
                camera.rotation.set(rotation.pitch, rotation.yaw, 0, 'YXZ')
              })
            : thirdPersonCamera.update(camera, currentPlayerPos, EYE_LEVEL_OFFSET)
        ),
        // Shadow frustum follows player so terrain around them is always shadow-covered
        // FR-009: Only update when player has moved more than 0.5 blocks (avoids per-frame updateMatrixWorld)
        Effect.andThen(Effect.sync(() => {
          const lastTarget = MutableRef.get(lastShadowTargetRef)
          const dx = currentPlayerPos.x - lastTarget.x
          const dz = currentPlayerPos.z - lastTarget.z
          if (dx * dx + dz * dz > 0.25) {
            MutableRef.set(lastShadowTargetRef, { x: currentPlayerPos.x, z: currentPlayerPos.z })
            deps.lights.light.target.position.set(currentPlayerPos.x, 0, currentPlayerPos.z)
            deps.lights.light.target.updateMatrixWorld()
            markShadowMapDirty()
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
              const cam = deps.lights.light.shadow.camera
              cam.far = Math.max(currentSettings.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300)
              cam.left = -halfExtent
              cam.right = halfExtent
              cam.top = halfExtent
              cam.bottom = -halfExtent
              cam.updateProjectionMatrix()
              markShadowMapDirty()
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
              const villagerOption = yield* villageService.findNearestVillager(currentPlayerPos, TRADE_DISTANCE)
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
          } else {
            const inventoryOpenAfterToggles = yield* inventoryRenderer.isOpen()
            if (inventoryOpenAfterToggles) {
              if (tradePrevPressed) {
                yield* inventoryRenderer.cycleRecipes(-1)
              }
              if (tradeNextPressed) {
                yield* inventoryRenderer.cycleRecipes(1)
              }
              if (tradeExecutePressed) {
                yield* inventoryRenderer.craftSelectedRecipe()
              }
            }
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
          const selectedHotbarItem = yield* hotbarService.getSelectedBlockType()

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

          if (leftClick) {
            const targetEntity = yield* entityManager.getEntities().pipe(
              Effect.map((entities) => findAttackableEntity(entities, camera, Option.map(targetHit, (hit) => hit.distance))),
            )

            yield* Option.match(targetEntity, {
              onNone: () => Option.match(targetBlock, {
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
              }),
              onSome: (entityId) =>
                entityManager.applyDamage(
                  entityId,
                  Option.match(selectedHotbarItem, {
                    onNone: () => PLAYER_ATTACK_DAMAGE,
                    onSome: (item) => item === 'WOODEN_SWORD' ? WOODEN_SWORD_ATTACK_DAMAGE : PLAYER_ATTACK_DAMAGE,
                  }),
                ).pipe(
                  Effect.flatMap((drops) =>
                    Effect.forEach(
                      Option.getOrElse(drops, () => []),
                      (drop) => inventoryService.addBlock(drop.blockType, drop.count),
                      { concurrency: 'unbounded', discard: true },
                    ),
                  ),
                ),
            })
          }

          if (rightClick) yield* Option.match(targetHit, {
            onNone: () => Effect.void,
            onSome: (hit) => {
              const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
              const targetChunkCoord = { x: Math.floor(targetPos.x / CHUNK_SIZE), z: Math.floor(targetPos.z / CHUNK_SIZE) }
              return chunkManagerService.getChunk(targetChunkCoord).pipe(
                Effect.flatMap((targetChunk) => {
                  const targetLx = ((targetPos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                  const targetLz = ((targetPos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                  const targetIdx = targetPos.y + targetLz * CHUNK_HEIGHT + targetLx * CHUNK_HEIGHT * CHUNK_SIZE
                  const targetBlockType = indexToBlockType(targetChunk.blocks[targetIdx] ?? 0)
                  if (targetBlockType === 'FURNACE') {
                    return furnaceService.setSelectedFurnace(targetPos)
                  }

                  const adjacentPos = {
                    x: hit.blockX + Math.round(hit.normal.x),
                    y: hit.blockY + Math.round(hit.normal.y),
                    z: hit.blockZ + Math.round(hit.normal.z),
                  }
                  return Effect.all([
                    hotbarService.getSelectedBlockType(),
                    hotbarService.getSelectedSlot(),
                  ], { concurrency: 'unbounded' }).pipe(
                    Effect.flatMap(([selectedBlock, selectedSlot]) => Option.match(selectedBlock, {
                      onNone: () => Effect.void,
                      onSome: (blockType) => {
                        const chunkCoord = { x: Math.floor(adjacentPos.x / CHUNK_SIZE), z: Math.floor(adjacentPos.z / CHUNK_SIZE) }
                        const coordKey = `${chunkCoord.x},${chunkCoord.z}`
                        return blockService.placeBlock(adjacentPos, blockType, SlotIndex.make(HOTBAR_START + selectedSlot)).pipe(
                          Effect.flatMap(() => soundManager.playEffect('blockPlace', { position: adjacentPos })),
                          Effect.andThen(chunkManagerService.getChunk(chunkCoord)),
                          Effect.flatMap((updatedChunk) => Ref.update(dirtyChunksRef, (map) => HashMap.set(map, coordKey, updatedChunk)))
                        )
                      },
                    })),
                  )
                }),
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
      yield* Ref.set(
        frustumThrottleStrideRef,
        fps >= 100 ? 1 : fps >= 60 ? 2 : 4,
      )
      const adaptiveCooldown = yield* Ref.get(adaptiveQualityCooldownRef)
      const adaptiveQualityDecision = decideAdaptiveQuality({
        adaptivePerformanceMode: currentSettings.adaptivePerformanceMode,
        graphicsQuality: currentSettings.graphicsQuality,
        renderDistance: currentSettings.renderDistance,
        fps,
        cooldown: adaptiveCooldown,
      })
      if (adaptiveQualityDecision.nextCooldown !== adaptiveCooldown) {
        yield* Ref.set(adaptiveQualityCooldownRef, adaptiveQualityDecision.nextCooldown)
      }
      if (adaptiveQualityDecision.settingsPatch !== null) {
        yield* settingsService.updateSettings(adaptiveQualityDecision.settingsPatch)
      }
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
          const sceneVersionBeforeRefraction = yield* worldRendererService.getSceneVersion()
          const currentRefractionPose = captureCameraPose(deps.camera, sceneVersionBeforeRefraction)
          const lastRefractionFrame = MutableRef.get(lastRefractionFrameRef)
          const shouldRunRefraction = hasCameraPoseChanged(lastRefractionFrame, currentRefractionPose)

          if (shouldRunRefraction) {
            yield* worldRendererService.doRefractionPrePass(deps.renderer, deps.scene, deps.camera).pipe(
              Effect.catchAllCause((cause) => Effect.logError(`Refraction pre-pass error: ${Cause.pretty(cause)}`))
            )
            MutableRef.set(lastRefractionFrameRef, currentRefractionPose)
            yield* Ref.getAndSet(refractionValidRef, true).pipe(
              Effect.flatMap((wasValid) => wasValid ? Effect.void : worldRendererService.setRefractionValid(true))
            )
          }
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
      if (graphicsChanged || pixelRatioChanged) {
        yield* Effect.sync(() => {
          const w = renderer.domElement.clientWidth || 1
          const h = renderer.domElement.clientHeight || 1
          const pixelRatio = typeof renderer.getPixelRatio === 'function' ? renderer.getPixelRatio() : 1
          const rw = Math.max(1, Math.ceil(w * pixelRatio))
          const rh = Math.max(1, Math.ceil(h * pixelRatio))
          if (deps.lights.light.castShadow !== resolvedGraphics.shadowsEnabled) {
            deps.lights.light.castShadow = resolvedGraphics.shadowsEnabled
            markShadowMapDirty()
          }
          if (gtaoPassOrNull) {
            const enabled = resolvedGraphics.ssaoEnabled && renderer.capabilities.isWebGL2
            gtaoPassOrNull.enabled = enabled
            // FR-014: Half-resolution GTAO — 75% fill reduction with acceptable quality loss
            gtaoPassOrNull.setSize(enabled ? Math.ceil(rw / 2) : 1, enabled ? Math.ceil(rh / 2) : 1)
          }
          if (bloomPassOrNull) {
            bloomPassOrNull.enabled = resolvedGraphics.bloomEnabled; bloomPassOrNull.strength = resolvedGraphics.bloomStrength
            bloomPassOrNull.setSize(resolvedGraphics.bloomEnabled ? rw : 1, resolvedGraphics.bloomEnabled ? rh : 1)
          }
          if (dofPassOrNull) {
            dofPassOrNull.enabled = resolvedGraphics.dofEnabled
            dofPassOrNull.setSize(resolvedGraphics.dofEnabled ? rw : 1, resolvedGraphics.dofEnabled ? rh : 1)
          }
          if (smaaPassOrNull) {
            smaaPassOrNull.enabled = resolvedGraphics.smaaEnabled
            smaaPassOrNull.setSize(resolvedGraphics.smaaEnabled ? rw : 1, resolvedGraphics.smaaEnabled ? rh : 1)
          }
          if (godRaysPassOrNull) {
            godRaysPassOrNull.setNumSamples(resolvedGraphics.godRaysSamples)
            godRaysPassOrNull.setSize(resolvedGraphics.godRaysEnabled ? rw : 1, resolvedGraphics.godRaysEnabled ? rh : 1)
          }
        })
      }

      yield* Effect.sync(() => {
        if (godRaysPassOrNull) {
          if (resolvedGraphics.godRaysEnabled) {
            const lightPos = deps.lights.light.position
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

      // 10. Render HUD hotbar overlay (second pass; autoClear=false prevents erasing the main scene)
      yield* Effect.sync(() => { renderer.autoClear = false }).pipe(
        Effect.andThen(hotbarRenderer.render(renderer)),
        Effect.andThen(Effect.sync(() => { renderer.autoClear = true })),
        Effect.catchAllCause((cause) => Effect.logError(`HUD render error: ${Cause.pretty(cause)}`))
      )
    })

    return { frameHandler, maintenanceHandler }
  })

/**
 * Creates coordinated frame + maintenance handlers that share chunk-sync state.
 */
export const createFrameHandlers = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
): Effect.Effect<FrameLoopHandlers> => createFrameLoopHandlersInternal(deps, services)

/**
 * Backward-compatible single frame handler factory used by tests.
 */
export const createFrameHandler = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
): Effect.Effect<(deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>> =>
  createFrameLoopHandlersInternal(deps, services).pipe(
    Effect.map(({ frameHandler, maintenanceHandler }) =>
      (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
    )
  )
